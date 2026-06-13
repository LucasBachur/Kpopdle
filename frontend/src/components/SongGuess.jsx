import './SongGuess.css'
import { useState, useRef, useEffect } from "react";
import Confetti from 'react-confetti';
import { todayArg, useStats } from '../utils.js'
import GuessInput from './GuessInput.jsx'
import StatsModal from './StatsModal.jsx'



const getStorageKey = (mode) => `kpopdle_song_guesses_${mode}_${todayArg()}`;

function Guess({ guess, answer }) {
  const correct = guess.id === answer.id;
  return (
    <div className={`guess-card ${correct ? "correct" : "incorrect"}`}>
      <div className="guess-text">
        <span className="guess-title">{guess.title}</span>
        <span className="guess-group"> – {guess.group}</span>
      </div>
      <div className="guess-status">{correct ? "✅" : "❌"}</div>
    </div>
  );
}


function GuessList({ guesses, answer}) {
    return (
        <div className='guess-list-ss'>
            {guesses.map((guess, index) => {
                return <Guess key={index} guess={guess} answer={answer}/>;
            })}
        </div>
    );
}



function SongGuess({songData, answer, mode}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [guesses, setGuesses] = useState([]);
  const [victory, setVictory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const { stats, registerGame } = useStats('kpopdleSongStats', mode);
  const [volume, setVolume] = useState(1); // volumen inicial al máximo (1)
  const audioRef = useRef(null);
  const bottomRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);


  // Definimos la progresión de tiempo
  const timeUnlocks = [1, 2, 4, 7, 11, 16];

  let songDataForMode = (mode != 'All') ? songData.filter(idol => idol.groupType === mode) : songData;


  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Si está en pausa en un punto > maxTime, lo llevamos al inicio
      if (audio.currentTime > duration) {
        audio.currentTime = 0;
      }
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (e) => {
    const newVolume = e.target.value;
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  useEffect(() => {
    const key = getStorageKey(mode);
    const saved = localStorage.getItem(key);
    if (saved) {
        const parsed = JSON.parse(saved);
        setGuesses(parsed);
        setVictory(parsed.some(guess => guess.id === answer.id));
    } else {
        setGuesses([]);
        setVictory(false);
    }
    setIsPlaying(false);
  }, [mode, answer]);

  useEffect(() => {
      if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [guesses]);

  useEffect(() => {
      const key = getStorageKey(mode);
      if(guesses.length !== 0){
          localStorage.setItem(key, JSON.stringify(guesses));
      }
      const isWon = guesses.some(guess => guess.id === answer.id);
      const nextLimit = timeUnlocks[guesses.length];
      if (nextLimit && !isWon) setDuration(nextLimit);
      else setDuration(timeUnlocks[timeUnlocks.length - 1]);
  }, [guesses, answer]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);

    audio.addEventListener('timeupdate', updateTime);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const checkLimit = () => {
      if (audio.currentTime >= duration) {
        audio.pause();
        audio.currentTime = 0; // 🔄 vuelve al inicio
        setIsPlaying(false);
      }
    };

    audio.addEventListener("timeupdate", checkLimit);
    return () => audio.removeEventListener("timeupdate", checkLimit);
  }, [duration]);


  function progressAudio() {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play();
      setIsPlaying(true);
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div className="song-guess">
      {victory && (
          <div style={{
              position: 'fixed',
              top: 0, left: 0,
              width: '100vw',
              height: '100vh',
              pointerEvents: 'none',
              zIndex: 9999
          }}>
              <Confetti width={window.innerWidth} height={window.innerHeight} />
          </div>
      )}

      <audio ref={audioRef} src={"/audios/"+answer.id+".mp3"} />

      <div className="controls">
        <button onClick={togglePlay} className="play-btn">
          {isPlaying ? "⏸" : "▶"}
        </button>

        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={(e) => {
            const newTime = Number(e.target.value);
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
          }}
          className="progress-bar"
        />
        <div className="time-info">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Volumen */}
        <div className="volume-container">
          <span className="volume-icon">
            🔊
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-bar"
          />
        </div>
      </div>
        <>
          <div className="top-bar-ss">
            <GuessInput
              data={songDataForMode}
              guesses={guesses}
              victory={victory}
              setGuesses={setGuesses}
              setVictory={setVictory}
              answer={answer}
              getLabel={song => `${song.title} - ${song.group}`}
              getSearchTerms={song => [song.title, song.group]}
              onGuess={progressAudio}
              onCorrectGuess={count => registerGame(count)}
            />
            <button className="stats-button" onClick={() => setShowStats(true)}>📊</button>
          </div>

          <GuessList guesses={guesses} answer={answer} />
          <div ref={bottomRef} />
          {showStats && (
            <StatsModal stats={stats} onClose={() => setShowStats(false)} />
          )}
        </>
    </div>
  );
}

export default SongGuess;
