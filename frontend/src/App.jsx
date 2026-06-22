import './App.css'
import { fetchDataBackend } from '../api.js'
import { todayArg } from './utils.js'
import ModeSelector from './components/ModeSelector'
import Kpopdle from './components/Kpopdle'
import SongGuess from './components/SongGuess.jsx'
import LoadingScreen from './components/LoadingScreen';
import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { getAccessToken, getStoredUsername, logout as apiLogout } from './card-game/services/cardGameApi';
import LoginPage from './card-game/pages/LoginPage';
import WelcomePage from './card-game/pages/WelcomePage';
import CollectionPage from './card-game/pages/CollectionPage';
import LineupPage from './card-game/pages/LineupPage';
import BannersPage from './card-game/pages/BannersPage';
import LeaderboardPage from './card-game/pages/LeaderboardPage';
import ShowResultPage from './card-game/pages/ShowResultPage';


const cleanupOldLocalStorage = () => {
  const todayStr = todayArg();
  const prefix = 'kpopdle_';
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(prefix)) {
      const parts = key.split('_');
      const dateStr = parts[parts.length - 1];
      if (dateStr !== todayStr) {
        localStorage.removeItem(key);
      }
    }
  });
};

function RequireAuth() {
  const token = getAccessToken();
  if (!token) return <Navigate to="/card-game/login" replace />;
  return <Outlet />;
}

function Sidebar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isHoverDevice = useRef(window.matchMedia('(hover: hover) and (pointer: fine)').matches).current;

  // Re-derived on every render; useLocation() re-renders Sidebar on each navigation,
  // so this stays in sync after login and logout.
  const isAuthed = !!getAccessToken();
  const username = getStoredUsername();

  function handleLogout() {
    apiLogout();
    navigate('/card-game/login');
  }

  return (
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
      {open && (
        <div className="sidebar-content">
          <h2>Games</h2>
          <Link to="/kpopdle" className={pathname === '/kpopdle' ? 'active' : ''}>Kpopdle</Link>
          <Link to="/songguess" className={pathname === '/songguess' ? 'active' : ''}>Guess the Song</Link>
          <h2>Card Game</h2>
          {isAuthed ? (
            <>
              <Link to="/card-game/collection" className={pathname.startsWith('/card-game/collection') ? 'active' : ''}>Collection</Link>
              <Link to="/card-game/lineup" className={pathname.startsWith('/card-game/lineup') ? 'active' : ''}>Lineup</Link>
              <Link to="/card-game/banners" className={pathname.startsWith('/card-game/banners') ? 'active' : ''}>Banners</Link>
              <Link to="/card-game/leaderboard" className={pathname.startsWith('/card-game/leaderboard') ? 'active' : ''}>Leaderboard</Link>
            </>
          ) : (
            <Link to="/card-game/login" className={pathname.startsWith('/card-game/login') ? 'active' : ''}>Sign In</Link>
          )}
        </div>
      )}
      {open && isAuthed && (
        <div className="account-section">
          <span className="account-user">● {username}</span>
          <button className="logout-btn" onClick={handleLogout}>Log out</button>
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

// Wrapper that loads main Kpopdle data — card game routes bypass this entirely.
function KpopldeApp({ mode, setMode }) {
  const [idolData, setIdolData] = useState([]);
  const [answers, setAnswers] = useState({ All: [], "Girl Group": [], "Boy Group": [] });
  const [songData, setSongData] = useState([]);
  const [songAnswers, setSongAnswers] = useState({ All: [], "Girl Group": [], "Boy Group": [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
    <>
      <ModeSelector setMode={setMode} currentMode={mode} />
      <Routes>
        <Route path="/" element={<Navigate to="/kpopdle" replace />} />
        <Route path="/kpopdle" element={<Kpopdle idolData={idolData} answer={todaysAnswerData} mode={mode} />} />
        <Route path="/songguess" element={<SongGuess songData={songData} answer={todaysSongAnswerData} mode={mode} />} />
      </Routes>
    </>
  );
}

function App() {
  const [mode, setMode] = useState('All');

  useEffect(() => {
    cleanupOldLocalStorage();
  }, []);

  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            {/* Card game routes — no main-data dependency */}
            <Route path="/card-game/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/card-game/welcome" element={<WelcomePage />} />
              <Route path="/card-game/collection" element={<CollectionPage />} />
              <Route path="/card-game/lineup" element={<LineupPage />} />
              <Route path="/card-game/banners" element={<BannersPage />} />
              <Route path="/card-game/leaderboard" element={<LeaderboardPage />} />
              <Route path="/card-game/show-result/:showId" element={<ShowResultPage />} />
            </Route>

            {/* Main Kpopdle app — loads its own data */}
            <Route path="/*" element={<KpopldeApp mode={mode} setMode={setMode} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App
