import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const isTest = process.argv[2] === 'Test';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logPath = path.join(__dirname, '/logs/errorLog.log');
const idolDataPath = path.join(__dirname, '/src/data/idols.json');
const answersPath = path.join(__dirname, `/src/data/dailyAnswers${isTest?'Test':''}.json`);
const PERCENTILE = 0.1; // 10% of the array
const MAX_UNUSED_DAYS_FACTOR = 1.7; // Multiplier for the number of idols in the dataset, 
                                    // to determine the maximun number of days it can be unused
const GROUP_REPEAT_BLOCK_DAYS = 3;

function logError(message) {
    const timestamp = new Date().toISOString();
    const fullMessage = `[${timestamp}] ${message}\n`;
    try {
        fs.appendFileSync(logPath, fullMessage);
    } catch (fileWriteError) {
        console.error(`[${timestamp}] Failed to write to error log: ${fileWriteError.message}`);
    }
}

function readJSON(filePath) {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function pickRandomFromTop(array) {
    const percentileCount = Math.floor(array.length * PERCENTILE);
    const randomIndex = Math.round(Math.random() * percentileCount);
    return array[randomIndex];
}

function datediff(date1, date2) {
    return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
}

function generateAnswerForMode(mode, idolData, answers, today, todayAllId) {
    const relevantIdols = idolData.filter(idol =>
        (mode === 'All' || idol.groupType === mode)
    );
    let idolsWithId = [];
    relevantIdols.forEach((idol) => {
        idolsWithId[idol.id] = {id: idol.id, group:idol.group, lastUsed: null};
    });
    const recentGroups = new Set(
        answers[mode]
        .slice(-GROUP_REPEAT_BLOCK_DAYS)
        .map(entry => idolsWithId[entry.answerId].group)
    );
    for (const {date, answerId} of answers[mode]) {
        if (date === today){
            throw new Error(`The answer for (${today}) in the mode ${mode} is already set to ${answerId}.`);
        }
        const prevDate = idolsWithId[answerId].lastUsed;
        let newDate = new Date(date);
        if (!prevDate || newDate > new Date(prevDate)) {
            idolsWithId[answerId].lastUsed = newDate;
        }
    }
    console.log('Today Id for all mode:', todayAllId);
    idolsWithId = idolsWithId.filter(idol => !recentGroups.has(idol.group) && idol.id !== todayAllId);
    shuffleArray(idolsWithId); // Shuffle first so if a lot of elements have a null lastUsed, they will be randomly distributed
    idolsWithId.sort((a, b) => {
        if (a.lastUsed === null && b.lastUsed === null) return 0;
        if (a.lastUsed === null) return -1;
        if (b.lastUsed === null) return 1;
        return a.lastUsed - b.lastUsed;
    });
    const firstIdol = idolsWithId[0];
    const dayCap = Math.floor(idolsWithId * MAX_UNUSED_DAYS_FACTOR);
    let newEntryId;
    if(!firstIdol.lastUsed || datediff(new Date(firstIdol.lastUsed), new Date(today)) > dayCap){
        newEntryId = firstIdol.id;
    }
    else{
        newEntryId = pickRandomFromTop(idolsWithId).id;
    }
    const newEntry = {
        date: today, // format: YYYY-MM-DD
        answerId: newEntryId
    };
    console.log(`Generated answer for mode ${mode} on ${today}: ${newEntryId}`);
    return newEntry;
}

function generateAnswers(targetDate = null){
    try {
        const today = targetDate ?? new Date().toISOString().slice(0, 10); // format: YYYY-MM-DD
        const idolData = readJSON(idolDataPath);
        const answers = readJSON(answersPath);
        let todayAllId = null;
        
        const modes = ['All', 'Girl Group', 'Boy Group'];
        for (const mode of modes) {
            const entry = generateAnswerForMode(mode, idolData, answers, today, todayAllId);
            if (mode === 'All') {
                todayAllId = entry.answerId;
            }
            answers[mode].push(entry);
        }
        
        fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2));
    } catch (error) {
        logError(error.message);
    }
}

generateAnswers(); // Generate today's answers


/*const year = "2024";
const startDate = new Date(`${year}-01-23`);
const endDate = new Date(`${year}-01-31`);

for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().slice(0, 10);
    generateAnswers(dateStr);
}*/

/*function countFrequenciesByMode(filePath) {
  const answersData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const modes = ['All', 'Girl Group', 'Boy Group'];

  for (const mode of modes) {
    const freq = {};

    // Count how many times each ID appears
    for (const entry of answersData[mode]) {
      const id = entry.answerId;
      freq[id] = (freq[id] || 0) + 1;
    }

    // Build a distribution: how many IDs have x appearances
    const distribution = {};
    for (const count of Object.values(freq)) {
      distribution[count] = (distribution[count] || 0) + 1;
    }

    // Print the distribution
    console.log(`\nFrequency distribution for mode: ${mode}`);
    const sortedCounts = Object.keys(distribution).map(Number).sort((a, b) => a - b);
    for (const count of sortedCounts) {
      console.log(`  ${distribution[count]} id(s) appear exactly ${count} time(s)`);
    }
  }
}
countFrequenciesByMode(answersPath);*/