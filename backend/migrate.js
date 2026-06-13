const { MongoClient, ServerApiVersion } = require('mongodb');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_URL = process.env.DATABASE_URL;

if (!MONGODB_URI) { console.error('Missing MONGODB_URI in .env'); process.exit(1); }
if (!DATABASE_URL) { console.error('Missing DATABASE_URL in .env'); process.exit(1); }

const CREATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS idols (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    "group"     TEXT    NOT NULL,
    group_type  TEXT    NOT NULL,
    birth_date  DATE    NOT NULL,
    nationality TEXT    NOT NULL,
    company     TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS songs (
    id          INTEGER PRIMARY KEY,
    title       TEXT    NOT NULL,
    "group"     TEXT    NOT NULL,
    group_type  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_answers (
    id          SERIAL  PRIMARY KEY,
    mode        TEXT    NOT NULL CHECK (mode IN ('All', 'Girl Group', 'Boy Group')),
    date        DATE    NOT NULL,
    answer_id   INTEGER NOT NULL REFERENCES idols(id),
    UNIQUE (mode, date)
  );

  CREATE TABLE IF NOT EXISTS daily_answers_songs (
    id          SERIAL  PRIMARY KEY,
    mode        TEXT    NOT NULL CHECK (mode IN ('All', 'Girl Group', 'Boy Group')),
    date        DATE    NOT NULL,
    answer_id   INTEGER NOT NULL REFERENCES songs(id),
    UNIQUE (mode, date)
  );
`;

async function migrate() {
  const mongo = new MongoClient(MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
  });
  const pg = new Pool({ connectionString: DATABASE_URL });

  try {
    await mongo.connect();
    const db = mongo.db('kpopdle');

    console.log('Creating schema...');
    await pg.query(CREATE_SCHEMA);

    console.log('Migrating idols...');
    const idols = await db.collection('idols').find({}).toArray();
    for (const idol of idols) {
      await pg.query(
        `INSERT INTO idols (id, name, "group", group_type, birth_date, nationality, company)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [idol.id, idol.name, idol.group, idol.groupType, idol.birthDate, idol.nationality, idol.company]
      );
    }
    console.log(`  → ${idols.length} idols migrated`);

    console.log('Migrating songs...');
    const songs = await db.collection('songs').find({}).toArray();
    for (const song of songs) {
      await pg.query(
        `INSERT INTO songs (id, title, "group", group_type)
         VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [song.id, song.title, song.group, song.groupType]
      );
    }
    console.log(`  → ${songs.length} songs migrated`);

    console.log('Migrating daily answers...');
    const dailyAnswers = await db.collection('dailyAnswers').find({}).toArray();
    for (const answer of dailyAnswers) {
      await pg.query(
        `INSERT INTO daily_answers (mode, date, answer_id)
         VALUES ($1, $2, $3) ON CONFLICT (mode, date) DO NOTHING`,
        [answer.mode, answer.date, answer.answerId]
      );
    }
    console.log(`  → ${dailyAnswers.length} daily answers migrated`);

    console.log('Migrating daily song answers...');
    const dailyAnswersSongs = await db.collection('dailyAnswersSongs').find({}).toArray();
    for (const answer of dailyAnswersSongs) {
      await pg.query(
        `INSERT INTO daily_answers_songs (mode, date, answer_id)
         VALUES ($1, $2, $3) ON CONFLICT (mode, date) DO NOTHING`,
        [answer.mode, answer.date, answer.answerId]
      );
    }
    console.log(`  → ${dailyAnswersSongs.length} daily song answers migrated`);

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await mongo.close();
    await pg.end();
  }
}

migrate();
