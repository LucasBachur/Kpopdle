const { getFromDB, saveAnswers } = require('./db');

const PERCENTILE = 0.1; // 10% of the array
const MAX_UNUSED_DAYS_FACTOR = 1.7; // Multiplier for the number of idols in the dataset, 
                                    // to determine the maximun number of days it can be unused
const GROUP_REPEAT_BLOCK_DAYS = 3; // Number of days to block repeating groups

function todayArg(withTime = false) {
  const options = {
    timeZone: 'America/Argentina/Buenos_Aires'
  };

  if (withTime) {
    options.hour12 = false,
    options.year = 'numeric',
    options.month = 'numeric',
    options.day = 'numeric',
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
  }

  return new Date().toLocaleString('en-CA', options);
}

function logError(message) {
    const timestamp = todayArg(true);
    console.error(`[${timestamp}] ${message}`);
}

function pickRandomFromTop(array) {
    const percentileCount = Math.floor(array.length * PERCENTILE);
    const randomIndex = Math.round(Math.random() * percentileCount);
    return array[randomIndex];
}

function datediff(date1, date2) {
    return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
}

function generateAnswerForMode(mode, data, answers, today, todayAllId) {
    const modeAnswers = answers.filter(entry => entry.mode === mode);
    const dataForMode = data.filter(element =>
        (mode === 'All' || element.groupType === mode)
    );
    // Creo la lista con id y grupo y le agrego lastUsed sin inicializar
    let dataWithDates = [];
    dataForMode.forEach((el) => {
        dataWithDates[el.id] = {id: el.id, group:el.group, lastUsed: null};
    });
    const recentGroups = new Set(
        modeAnswers
        .slice(-GROUP_REPEAT_BLOCK_DAYS)
        .map(entry => dataWithDates[entry.answerId].group)
    );
    // Actualizo el lastUsed de cada idol, viendo todas las respuestas diarias anteriores
    for (const {date, answerId} of modeAnswers) {
        if (date === today){
            throw new Error(`The answer for (${today}) in the mode ${mode} is already set to ${answerId}.`);
        }
        const prevDate = dataWithDates[answerId].lastUsed;
        let newDate = new Date(date);
        if (!prevDate || newDate > new Date(prevDate)) {
            dataWithDates[answerId].lastUsed = newDate;
        }
    }
    // Quito los elementos que pertenecen a grupos recientes y el que fue elegido hoy en "All"
    dataWithDates = dataWithDates.filter(el => !recentGroups.has(el.group) && el.id !== todayAllId);
    dataWithDates.sort((a, b) => {
        // Si ninguno se uso nunca, los ordeno aleatoriamente
        if (a.lastUsed === null && b.lastUsed === null) return (Math.random() < 0.5) ? -1 : 1; 
        if (a.lastUsed === null) return -1;
        if (b.lastUsed === null) return 1;
        return a.lastUsed - b.lastUsed;
    });

    const firstEle = dataWithDates[0];
    const dayCap = Math.floor(dataWithDates.length * MAX_UNUSED_DAYS_FACTOR);
    let newEntryId;
    // Si el primer elemento no se uso nunca o hace mucho que no se uso, lo elijo directamente
    if(!firstEle.lastUsed || datediff(new Date(firstEle.lastUsed), new Date(today)) > dayCap){
        newEntryId = firstEle.id;
    }
    else{ // Si no, elijo aleatoriamente entre los primeros
        newEntryId = pickRandomFromTop(dataWithDates).id;
    }
    const newEntry = {
        mode: mode,
        date: today, // format: YYYY-MM-DD
        answerId: newEntryId
    };
    return newEntry;
}

async function generateAnswers(dataCollection, answersCollection ,targetDate = null){
    try {
        const today = targetDate ?? todayArg().slice(0, 10); // format: YYYY-MM-DD
        const idolData = await getFromDB(dataCollection);
        const answers = await getFromDB(answersCollection);
        
        let todayAllId = null;
        let newEntries = [];

        const modes = ['All', 'Girl Group', 'Boy Group'];
        for (const mode of modes) {
            const entry = generateAnswerForMode(mode, idolData, answers, today, todayAllId);
            if (mode === 'All') {
                todayAllId = entry.answerId;
            }
            newEntries.push(entry);
        }
        await saveAnswers(answersCollection, newEntries);
    } catch (error) {
        logError(error.message);
    }
}
// Generate today's answers
generateAnswers('idols', 'dailyAnswers');
generateAnswers('songs', 'dailyAnswersSongs');

//generateAnswers('idols', 'dailyAnswers', "2025-10-17");
//generateAnswers('songs', 'dailyAnswersSongs', "2025-10-17");