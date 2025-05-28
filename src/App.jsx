import './App.css'
import idols from './data/idols.json'
import answers from './data/dailyAnswers.json'
import ModeSelector from './components/ModeSelector'
import Kpopdle from './components/Kpopdle'
import { useState, useEffect } from 'react';

function todayArg(withTime = false) {
  const options = {
    timeZone: 'America/Argentina/Buenos_Aires',
    year : 'numeric',
    month : 'numeric',
    day : 'numeric'
  };

  if (withTime) {
    options.hour12 = false,
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
  }

  return new Date().toLocaleString('en-CA', options);
}

const cleanupOldLocalStorage = () => {
  const todayStr = new Date().toISOString().split('T')[0]; // e.g. "2025-05-28"
  const prefix = 'kpopdle_guesses_';

  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(prefix)) {
      // Extract the date part from the key (last part after last '_')
      const parts = key.split('_');
      const dateStr = parts[parts.length - 1]; // YYYY-MM-DD

      if (dateStr !== todayStr) {
        localStorage.removeItem(key);
      }
    }
  });
};

function App() {
  const [mode, setMode] = useState('All');
  let idolData = idols;
  const todaysAnswer = answers[mode].filter(entry => entry.date === todayArg());
  const todaysAnswerData = todaysAnswer.map(answerEntry =>
    idolData.find(idol => idol.id === answerEntry.answerId)
  )[0];
  useEffect(() => {
    cleanupOldLocalStorage();
  }, []);
  return (
    <>
      <ModeSelector setMode={setMode} currentMode={mode}/>
      <Kpopdle idolData={idolData} answer={todaysAnswerData} mode={mode}/>
    </>
  )
}

export default App
