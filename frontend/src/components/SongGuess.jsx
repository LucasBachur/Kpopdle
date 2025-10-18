import './SongGuess.css'
import { useState, useRef, useEffect } from "react";

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

function normalizeString (str){
    return str
        .toLowerCase()
        .replace(/[-:.\s]/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

function Guess({ guess, answer}) {
    const song = guess.title + " - " + guess.group;
    return (
        <div className='guess-container'>
            {song + ((guess.id === answer.id) ? "✅" : " ❌")}
        </div>
    );
}

function GuessList({ guesses, answer}) {
    return (
        <div className='guess-list'>
            {guesses.map((guess, index) => {
                return <Guess key={index} guess={guess} answer={answer}/>;
            })}
        </div>
    );
}

function GuessInput({dataForMode, guesses, victory, setGuesses, setVictory, answer, progressAudio}) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [inputValue, setInputValue] = useState('');
    const suggestionRefs = useRef([]);

    let filteredSuggestions = dataForMode.filter(song =>
        (normalizeString(song.title).includes(normalizeString(inputValue))
        || normalizeString(song.group).includes(normalizeString(inputValue)))
         && !guesses.some(guess => guess.id == song.id)
    );

    useEffect(() => {
        setActiveIndex(-1);
    }, [inputValue, dataForMode]);

    useEffect(() => {
        if (
            showSuggestions &&
            activeIndex >= 0 &&
            suggestionRefs.current[activeIndex]
        ) {
            suggestionRefs.current[activeIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [activeIndex, showSuggestions]);

    const submitGuess = (id = null, title = null) => {
        let guessedSong = null;
        if (id) {
            guessedSong = dataForMode.find(song => song.id === id);
        } else if (title) {
            const matchedSongs = dataForMode.filter(song => normalizeString(song.title) === normalizeString(title));
            if (matchedSongs.length === 1) {
                guessedSong = matchedSongs[0];
            }
        }
        if (guessedSong && !guesses.some(guess => guess.id === guessedSong.id)) {
            setVictory(guessedSong.id === answer.id);
            /*if (guessedIdol.id === answer.id) {
                registerGame(guesses.length + 1);
            }*/
            setGuesses([...guesses, guessedSong]);
            setInputValue('');
            setShowSuggestions(false);
            progressAudio();
        }
    }

    const handleKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((prev) => (prev + 1) % filteredSuggestions.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
        } else if (event.key === 'Enter') {
            if (activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
                submitGuess(filteredSuggestions[activeIndex].id, null);
            } else {
                submitGuess(null, inputValue);
            }
            setActiveIndex(-1);
        }
    };

    return (
        <div className='input-container'>
            <input 
                type="text"
                value={inputValue}
                onChange={(e) => {
                    const value = e.target.value;
                    setInputValue(value);
                    setShowSuggestions(value.length>=2);
                }}
                className="input-field"
                onKeyDown={handleKeyDown} 
                placeholder="Type your guess"
                disabled={victory}
                onFocus={() => {setShowSuggestions(inputValue.length>=2);}}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className="suggestion-box">
                {filteredSuggestions.map((song, index) => (
                    <li key={song.id} 
                        ref={el => suggestionRefs.current[index] = el}
                        className={"suggestion-item" + ((index === activeIndex) ? ' active' : '')}
                        onMouseDown={() => {submitGuess(song.id, null);}}>
                    {song.title+ " - "+song.group}
                    </li>
                ))}
                </ul>
            )}
        </div>
    );
}

function SongGuess({songData, answer, mode}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 a 100 (%)
  const [guesses, setGuesses] = useState([]);
  const [maxTime, setMaxTime] = useState(1); // límite de segundos permitido
  const [victory, setVictory] = useState(false);
  const [volume, setVolume] = useState(1); // volumen inicial al máximo (1)
  const audioRef = useRef(null);
  const bottomRef = useRef(null);

  // Definimos la progresión de tiempo
  const timeUnlocks = [1, 2, 4, 7, 11, 16];

  let songDataForMode = (mode != 'All') ? songData.filter(idol => idol.groupType === mode) : songData;

  const getStorageKey = (mode) => {
      const today = todayArg(); // e.g., "2025-05-28"
      return `kpopdle_song_guesses_${mode}_${today}`;
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Si está en pausa en un punto > maxTime, lo llevamos al inicio
      if (audio.currentTime > maxTime) {
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

  // Evitar que el audio supere el límite de tiempo
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const checkLimit = () => {
      if (audio.currentTime >= maxTime) {
        audio.pause();
        setIsPlaying(false);
      }
      setProgress((audio.currentTime / maxTime) * 100 || 0);
    };

    audio.addEventListener("timeupdate", checkLimit);
    audio.addEventListener("ended", () => setIsPlaying(false));

    return () => {
      audio.removeEventListener("timeupdate", checkLimit);
    };
  }, [maxTime]);

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
      const nextLimit = timeUnlocks[guesses.length];
      if (nextLimit && !victory) setMaxTime(nextLimit);
      else setMaxTime(timeUnlocks[timeUnlocks.length - 1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses]);

  function progressAudio(){
    const audio = audioRef.current;
    const nextLimit = timeUnlocks[guesses.length + 1];
    if (nextLimit) setMaxTime(nextLimit);
    if (audio) {
      audio.currentTime = 0;
      audio.play();
      setIsPlaying(true);
    }
  }

  return (
    <div className="song-guess">
      <h1>Guess the Song 🎵</h1>

      <audio ref={audioRef} src={"/audios/"+answer.id+".mp3"} />

      <div className="controls">
        <button onClick={togglePlay} className="play-btn">
          {isPlaying ? "⏸" : "▶"}
        </button>

        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          className="progress-bar"
          readOnly
        />

        {/* Volumen */}
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
        <>
          <div className="top-bar">
            <GuessInput 
              dataForMode={songDataForMode}
              guesses={guesses}
              victory={victory}
              setGuesses={setGuesses}
              setVictory={setVictory}
              answer={answer}
              progressAudio={progressAudio}
            />
          </div>

          <GuessList guesses={guesses} answer={answer} />
          <div ref={bottomRef} />
        </>
    </div>
  );
}

export default SongGuess;
