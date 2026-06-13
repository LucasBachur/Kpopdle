import './App.css'
import { fetchDataBackend } from '../api.js'
import { todayArg } from './utils.js'
import ModeSelector from './components/ModeSelector'
import Kpopdle from './components/Kpopdle'
import SongGuess from './components/SongGuess.jsx'
import LoadingScreen from './components/LoadingScreen';
import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'


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
  const { pathname } = useLocation();
  const isHoverDevice = useRef(window.matchMedia('(hover: hover) and (pointer: fine)').matches).current;

  return(
    <div
      className={`sidebar ${open ? "open" : "closed"}`}
      onMouseEnter={isHoverDevice ? () => setOpen(true) : undefined}
      onMouseLeave={isHoverDevice ? () => setOpen(false) : undefined}
    >
      <button
        className="toggle-btn"
        onClick={isHoverDevice ? undefined : () => setOpen(!open)}
      >
        {open ? "❮" : "❯"}
      </button>
      {open &&(
      <div className="sidebar-content">
        <h2>Games</h2>
        <Link to="/kpopdle" className={pathname === '/kpopdle' ? 'active' : ''}>Kpopdle</Link>
        <Link to="/songguess" className={pathname === '/songguess' ? 'active' : ''}>Guess the Song</Link>
      </div>
      )}
    </div>
  );
}

function findLatestAnswer(entries, mode, data) {
  const date = new Date();
  for (let i = 0; i < 30; i++) {
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const entry = entries.find(a => a.date === dateStr && a.mode === mode);
    if (entry) return data.find(item => item.id === entry.answerId);
    date.setDate(date.getDate() - 1);
  }
  return undefined;
}

function App() {
  const [mode, setMode] = useState('All');
  const [idolData, setIdolData] = useState([]);
  const [answers, setAnswers] = useState({ All: [], "Girl Group": [], "Boy Group": [] });
  const [songData, setSongData] = useState([]);
  const [songAnswers, setSongAnswers] = useState({ All: [], "Girl Group": [], "Boy Group": [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    cleanupOldLocalStorage();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [idols, songs, dailyAnswers, dailyAnswersSongs] = await Promise.all([
          fetchDataBackend('idols'),
          fetchDataBackend('songs'),
          fetchDataBackend('answers'),
          fetchDataBackend('answersSongs'),
        ]);
        setIdolData(idols);
        setSongData(songs);
        setAnswers(dailyAnswers);
        setSongAnswers(dailyAnswersSongs);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p>Could not connect to the server.</p>
      <p>Please try again later.</p>
    </div>
  );

  const todaysAnswerData = findLatestAnswer(answers, mode, idolData);
  const todaysSongAnswerData = findLatestAnswer(songAnswers, mode, songData);

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
