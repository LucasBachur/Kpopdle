import './App.css'
import { fetchDataBackend } from '../api.js'
import ModeSelector from './components/ModeSelector'
import Kpopdle from './components/Kpopdle'
import SongGuess from './components/SongGuess.jsx'
import LoadingScreen from './components/LoadingScreen';
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'

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
  const todayStr = todayArg(); // e.g. "2025-05-28"
  const prefix = 'kpopdle_';
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

function Sidebar(){
  const [open, setOpen] = useState(false);

  return(
    <div
      className={`sidebar ${open ? "open" : "closed"}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button 
        className="toggle-btn" 
        onClick={() => {
          setOpen(!open);
        }}
      >
        {open ? "❮" : "❯"}
      </button>
      {open &&(
      <div className="sidebar-content">
        <h2>Games</h2>
        <Link to="/kpopdle" className={ window.location.pathname === '/kpopdle' ? 'active' : ''}>Kpopdle</Link>
        <Link to="/songguess" className={ window.location.pathname === '/songguess' ? 'active' : ''}>Guess the Song</Link>
      </div>
      )}
    </div>
  );
}

function App() {
  const [mode, setMode] = useState('All');
  const [idolData, setIdolData] = useState([]);
  const [answers, setAnswers] = useState({ All: [], "Girl Group": [], "Boy Group": [] });
  const [songData, setSongData] = useState([]);
  const [songAnswers, setSongAnswers] = useState({ All: [], "Girl Group": [], "Boy Group": [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cleanupOldLocalStorage();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const idols = await fetchDataBackend('idols');
        const songs = await fetchDataBackend('songs');
        const dailyAnswers = await fetchDataBackend('answers');
        const dailyAnswersSongs = await fetchDataBackend('answersSongs');
        setIdolData(idols);
        setAnswers(dailyAnswers);
        setSongData(songs);
        setSongAnswers(dailyAnswersSongs);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingScreen />;

  const todaysAnswer = answers.filter(entry => entry.date === todayArg() && entry.mode === mode);
  const todaysAnswerData = todaysAnswer.map(answerEntry =>
    idolData.find(idol => idol.id === answerEntry.answerId)
  )[0];
  const todaysSongAnswer = songAnswers.filter(entry => entry.date === todayArg() && entry.mode === mode);
  const todaysSongAnswerData = todaysSongAnswer.map(answerEntry =>
    songData.find(song => song.id === answerEntry.answerId)
  )[0];

  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <ModeSelector setMode={setMode} currentMode={mode}/>
          <Routes>
            <Route path="/" element={<Navigate to="/kpopdle" replace />} />
            <Route path="/kpopdle" element={<Kpopdle idolData={idolData} answer={todaysAnswerData} mode={mode} />} />
            <Route path="/songguess" element={<SongGuess songData={songData} answer={todaysSongAnswerData} mode={mode} />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App
