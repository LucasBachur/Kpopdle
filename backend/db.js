const { Pool } = require('pg');
const { DATABASE_URL } = require('./config');

const pool = new Pool({ connectionString: DATABASE_URL });

const TABLE_MAP = {
  idols:             'idols',
  songs:             'songs',
  dailyAnswers:      'daily_answers',
  dailyAnswersSongs: 'daily_answers_songs',
};

const QUERIES = {
  idols: `
    SELECT id, name, "group", group_type AS "groupType",
           TO_CHAR(birth_date, 'YYYY-MM-DD') AS "birthDate",
           nationality, company
    FROM idols
  `,
  songs: `
    SELECT id, title, "group", group_type AS "groupType"
    FROM songs
  `,
  daily_answers: `
    SELECT id, mode, TO_CHAR(date, 'YYYY-MM-DD') AS date, answer_id AS "answerId"
    FROM daily_answers
  `,
  daily_answers_songs: `
    SELECT id, mode, TO_CHAR(date, 'YYYY-MM-DD') AS date, answer_id AS "answerId"
    FROM daily_answers_songs
  `,
};

async function getFromDB(dataset) {
  const table = TABLE_MAP[dataset];
  if (!table) {
    console.error(`Unknown dataset: ${dataset}`);
    return [];
  }
  try {
    const { rows } = await pool.query(QUERIES[table]);
    return rows;
  } catch (err) {
    console.error(`Error fetching ${dataset}:`, err);
    return [];
  }
}

async function saveAnswers(collectionName, entries) {
  const table = TABLE_MAP[collectionName];
  if (!table) {
    console.error(`Unknown collection: ${collectionName}`);
    return;
  }
  try {
    for (const entry of entries) {
      await pool.query(
        `INSERT INTO ${table} (mode, date, answer_id) VALUES ($1, $2, $3)`,
        [entry.mode, entry.date, entry.answerId]
      );
    }
  } catch (err) {
    console.error('Error saving answers:', err);
  }
}

async function closeClient() {
  await pool.end();
}

module.exports = { getFromDB, saveAnswers, closeClient };
