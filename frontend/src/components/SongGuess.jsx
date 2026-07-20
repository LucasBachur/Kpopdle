import styles from './SongGuess.module.css';
import { useState, useRef, useEffect } from 'react';
import Confetti from 'react-confetti';
import { todayArg, useStats } from '../utils.js';
import GuessInput from './GuessInput.jsx';
import StatsModal from './StatsModal.jsx';
import ModeSelector from './ModeSelector.jsx';

const getStorageKey = (mode) => `kpopdle_song_guesses_${mode}_${todayArg()}`;
const timeUnlocks = [1, 2, 4, 7, 11, 16];

function fmtTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function SongGuess({ songData, answer, mode, setMode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [guesses, setGuesses] = useState([]);
  const [victory, setVictory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const { stats, registerGame } = useStats('kpopdleSongStats', mode);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef(null);
  const bottomRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const songDataForMode = (mode !== 'All') ? songData.filter(s => s.groupType === mode) : songData;

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      if (audio.currentTime > duration) audio.currentTime = 0;
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (e) => {
    const v = e.target.value;
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  useEffect(() => {
    const saved = localStorage.getItem(getStorageKey(mode));
    if (saved) {
      const parsed = JSON.parse(saved);
      setGuesses(parsed);
      setVictory(parsed.some(g => g.id === answer.id));
    } else {
      setGuesses([]);
      setVictory(false);
    }
    setIsPlaying(false);
  }, [mode, answer]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [guesses]);

  useEffect(() => {
    if (guesses.length !== 0) {
      localStorage.setItem(getStorageKey(mode), JSON.stringify(guesses));
    }
    const isWon = guesses.some(g => g.id === answer.id);
    const nextLimit = timeUnlocks[guesses.length];
    if (nextLimit && !isWon) setDuration(nextLimit);
    else setDuration(timeUnlocks[timeUnlocks.length - 1]);
  }, [guesses, answer, mode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(audio.currentTime);
    audio.addEventListener('timeupdate', updateTime);
    return () => audio.removeEventListener('timeupdate', updateTime);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const checkLimit = () => {
      if (audio.currentTime >= duration) {
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
      }
    };
    audio.addEventListener('timeupdate', checkLimit);
    return () => audio.removeEventListener('timeupdate', checkLimit);
  }, [duration]);

  function progressAudio() {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play();
      setIsPlaying(true);
    }
  }

  function seek(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = frac * duration;
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  }

  function suggestionRow(song) {
    const isGG = song.groupType === 'Girl Group';
    return (
      <>
        <span className={styles.sugAvatar}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M7 15.5V5l9-2v10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="5" cy="15.5" r="2" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="14" cy="13.5" r="2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <span className={styles.sugTitle}>{song.title}</span>
        <span className={styles.sugArtist}>{song.group}</span>
        <span className={`${styles.sugTag} ${isGG ? styles.tagGg : styles.tagBg}`}>{isGG ? 'GG' : 'BG'}</span>
      </>
    );
  }

  const progressPct = `${duration ? (currentTime / duration) * 100 : 0}%`;

  return (
    <div className={styles.page}>
      {victory && (
        <div className={styles.confetti}>
          <Confetti width={window.innerWidth} height={window.innerHeight} />
        </div>
      )}

      <audio ref={audioRef} src={`/audios/${answer.id}.mp3`} />

      <div className={styles.wrap}>
        <div className={styles.header}>
          <h1 className={styles.title}>Guess the Song</h1>
          <div className={styles.modeSlot}><ModeSelector setMode={setMode} currentMode={mode} /></div>
        </div>

        <div className={styles.player}>
          <button className={styles.playBtn} onClick={togglePlay} title="Play / pause">
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><rect x="3.5" y="2.5" width="4" height="13" rx="1.2" /><rect x="10.5" y="2.5" width="4" height="13" rx="1.2" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><path d="M4.5 3.2v11.6a1 1 0 0 0 1.5.87l9.2-5.8a1 1 0 0 0 0-1.72L6 2.35A1 1 0 0 0 4.5 3.2z" /></svg>
            )}
          </button>
          <div className={styles.progress} onClick={seek}>
            <div className={styles.progressFill} style={{ width: progressPct }} />
            <div className={styles.progressKnob} style={{ left: progressPct }} />
          </div>
          <div className={styles.time}>{fmtTime(currentTime)} <span className={styles.timeTotal}>/ {fmtTime(duration)}</span></div>
          <div className={styles.volume}>
            <span className={styles.volIcon}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 8v4h3l4 3V5L7 8H4z" fill="currentColor" /><path d="M14 7.5a3.5 3.5 0 0 1 0 5M16 5a6.5 6.5 0 0 1 0 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </span>
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className={styles.volSlider} />
          </div>
        </div>

        <div className={styles.guessBar}>
          <GuessInput
            data={songDataForMode}
            guesses={guesses}
            victory={victory}
            setGuesses={setGuesses}
            setVictory={setVictory}
            answer={answer}
            getSearchTerms={song => [song.title, song.group]}
            renderSuggestion={suggestionRow}
            onGuess={progressAudio}
            onCorrectGuess={count => registerGame(count)}
          />
          <button className={styles.statsBtn} onClick={() => setShowStats(true)} title="Statistics">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3.5" y="12" width="4.2" height="8" rx="1.4" fill="#66a84e" />
              <rect x="9.9" y="7" width="4.2" height="13" rx="1.4" fill="#f5c43d" />
              <rect x="16.3" y="4" width="4.2" height="16" rx="1.4" fill="#9b5de5" />
            </svg>
          </button>
        </div>

        <div className={styles.guessList}>
          {guesses.length === 0 ? (
            <div className={styles.emptyState}>Play the clip and type the track — each wrong guess reveals a little more.</div>
          ) : (
            guesses.map((g, i) => {
              const correct = g.id === answer.id;
              return (
                <div key={i} className={`${styles.guessCard} ${correct ? styles.correct : styles.incorrect}`}>
                  <div className={styles.guessText}>
                    <span className={styles.guessTitle}>{g.title}</span>
                    <span className={styles.guessArtist}> – {g.group}</span>
                  </div>
                  <span className={`${styles.guessStatus} ${correct ? styles.statusOk : styles.statusNo}`}>
                    {correct ? (
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 10.5l3 3 6.5-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {showStats && <StatsModal stats={stats} onClose={() => setShowStats(false)} nextLabel="NEXT SONG" />}
    </div>
  );
}

export default SongGuess;
