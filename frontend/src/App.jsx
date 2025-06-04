import './App.css'
import { fetchDataBackend } from '../api.js'
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
  const [idolData, setIdolData] = useState([]);
  const [answers, setAnswers] = useState({ All: [], "Girl Group": [], "Boy Group": [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cleanupOldLocalStorage();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const idols = await fetchDataBackend('idols');
        const dailyAnswers = await fetchDataBackend('answers');
        setIdolData(idols);
        setAnswers(dailyAnswers);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;

  const todaysAnswer = answers.filter(entry => entry.date === todayArg() && entry.mode === mode);
  const todaysAnswerData = todaysAnswer.map(answerEntry =>
    idolData.find(idol => idol.id === answerEntry.answerId)
  )[0];

  return (
    <>
      <ModeSelector setMode={setMode} currentMode={mode}/>
      <Kpopdle idolData={idolData} answer={todaysAnswerData} mode={mode}/>
    </>
  )
}

export default App
