import './Kpopdle.css';
import { useEffect, useState, useRef } from 'react';
import Confetti from 'react-confetti';

const getAge = birthDate => Math.floor((new Date() - new Date(birthDate).getTime()) / 3.15576e+10)

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

function GuessLabels({mode}) {
    const fields = ["", "Name", "Group", "Age", "Nationality", "Company"];
    if (mode === 'All') {
        fields.push("Group Type");
    }
    return (
        <div className="guess-container labels-row">
            {fields.map(field => (
                <div key={field} className={`label-item${field === "" ? " empty-label" : ""}`}>
                    {field}
                </div>
            ))}
        </div>
    );
}

function GuessField({field, value, answerValue}){
    let classes = '';
    let displayValue = value;
    if(field === 'birthDate' && value){
        if(getAge(value) === getAge(answerValue)){
            classes = ' correct';
        }
        else{
            classes = ' incorrect';
            classes += value > answerValue ? ' year-up' : ' year-down';
        }
        displayValue = getAge(value);
    }
    else{
        classes = (value === answerValue) ? ' correct' : ' incorrect';
    }
    return(
        <div className={'guess-item'+classes}>{displayValue}</div>
    );
}

function Guess({ guess, answer, mode }) {
    const fields = ["name", "group", "birthDate", "nationality", "company"];
    if (mode === 'All') {
        fields.push("groupType");
    }

    return (
        <div className='guess-container'>
            <div className='guess-item'>
                <img src={`/idol-images/${guess.id}.webp`} />
            </div>
            {fields.map((field) => (
            <GuessField key={field} field={field} value={guess[field]} answerValue={answer[field]}/>
            ))}
        </div>
    );
}

function GuessList({ guesses, answer, mode }) {
    return (
        <div className='guess-list'>
            <GuessLabels mode={mode}/>
            {guesses.map((guess, index) => {
                return <Guess key={index} guess={guess} answer={answer} mode={mode}/>;
            })}
        </div>
    );
}

function normalizeString (str){
    return str
        .toLowerCase()
        .replace(/[-:.\s]/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};

function GuessInput({idolDataForMode, guesses, victory, setGuesses, setVictory, answer, registerGame}) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [inputValue, setInputValue] = useState('');
    const suggestionRefs = useRef([]);

    let filteredSuggestions = idolDataForMode.filter(idol =>
        (normalizeString(idol.name).includes(normalizeString(inputValue))
        || normalizeString(idol.group).includes(normalizeString(inputValue)))
         && !guesses.some(guess => guess.id == idol.id)
    );

    useEffect(() => {
        setActiveIndex(-1);
    }, [inputValue, idolDataForMode]);

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

    const submitGuess = (id = null, name = null) => {
        let guessedIdol = null;
        if (id) {
            guessedIdol = idolDataForMode.find(idol => idol.id === id);
        } else if (name) {
            const matchedIdols = idolDataForMode.filter(idol => normalizeString(idol.name) === normalizeString(name));
            if (matchedIdols.length === 1) {
                guessedIdol = matchedIdols[0];
            }
        }
        if (guessedIdol && !guesses.some(guess => guess.id === guessedIdol.id)) {
            setVictory(guessedIdol.id === answer.id);
            if (guessedIdol.id === answer.id) {
                registerGame(guesses.length + 1);
            }
            setGuesses([...guesses, guessedIdol]);
            setInputValue('');
            setShowSuggestions(false);
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
                {filteredSuggestions.map((idol, index) => (
                    <li key={idol.id} 
                        ref={el => suggestionRefs.current[index] = el}
                        className={"suggestion-item" + ((index === activeIndex) ? ' active' : '')}
                        onMouseDown={() => {submitGuess(idol.id, null);}}>
                    {idol.name+ " ("+idol.group+")"}
                    </li>
                ))}
                </ul>
            )}
        </div>
    );
}

function useStats(mode) {
  const initialStats = {
    gamesPlayed: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null,
    guessDistribution: { 1: 0, 2: 2, 3: 5, 4: 10, "5+": 4 }
  };

  const storageKey = `kpopdleStats_${mode}`;

  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : initialStats;
  });

  function registerGame(attempts) {
    setStats(prev => {
      const today = todayArg();
      let { gamesPlayed, currentStreak, maxStreak, lastPlayedDate, guessDistribution } = prev;

      gamesPlayed++;

      // streak logic
      if (lastPlayedDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
        if (lastPlayedDate === yStr) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      maxStreak = Math.max(maxStreak, currentStreak);

      // attempts distribution
      const key = attempts <= 4 ? attempts : "5+";
      guessDistribution = { ...guessDistribution, [key]: (guessDistribution[key] || 0) + 1 };

      const newStats = {
        gamesPlayed,
        currentStreak,
        maxStreak,
        lastPlayedDate: today,
        guessDistribution
      };

      localStorage.setItem(storageKey, JSON.stringify(newStats)); // 👈 guardamos acá
      return newStats;
    });
  }

  return { stats, registerGame };
}

function StatsModal({ stats, onClose }) {
  const maxValue = Math.max(1,...Object.values(stats.guessDistribution));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        
        <h2>Stats</h2>
        <p>Total plays: {stats.gamesPlayed}</p>
        <p>Current Streak: {stats.currentStreak}</p>
        <p>Max Streak: {stats.maxStreak}</p>
        
        <h3>Number of tries distribution:</h3>
        <div className="distribution-container">
          {Object.entries(stats.guessDistribution).map(([attempts, count]) => {
            const pct = (count / maxValue) * 100;
            return (
                <div key={attempts} className="bar-wrapper">
                    {count > 0 && <span className="bar-count">{count}</span>}
                    <div
                    className="bar"
                    style={{ height: `${pct}%` }}
                    title={`${count} veces`}
                    />
                    <span className="bar-label">{attempts}</span>
                </div>
            );
        })}
        </div>
      </div>
    </div>
  );
}

const defaultGuesses = [];

function Kpopdle({ idolData, answer, mode}) {

    const [guesses, setGuesses] = useState(defaultGuesses);
    const [victory, setVictory] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const bottomRef = useRef(null);
    const { stats, registerGame } = useStats(mode);

    let idolDataForMode = (mode != 'All') ? idolData.filter(idol => idol.groupType === mode) : idolData;

    const getStorageKey = (mode) => {
        const today = todayArg(); // e.g., "2025-05-28"
        return `kpopdle_guesses_${mode}_${today}`;
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
    }, [mode, answer]);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [guesses]);

    useEffect(() => {
        const key = getStorageKey(mode);
        if(guesses !== defaultGuesses){
            localStorage.setItem(key, JSON.stringify(guesses));
        }
    }, [guesses, mode]);

    return (
        <div className='kpopdle-container'>
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

            <div className="top-bar">
                <GuessInput 
                    idolDataForMode={idolDataForMode}
                    guesses={guesses}
                    victory={victory}
                    setGuesses={setGuesses}
                    setVictory={setVictory}
                    answer={answer}
                    registerGame={registerGame}
                />
                <button className="stats-button" onClick={() => setShowStats(true)}>📊</button>
            </div>
            <GuessList 
                guesses={guesses} 
                answer={answer}
                mode={mode}
            />
            <div ref={bottomRef} />
            {showStats && (
                <StatsModal stats={stats} onClose={() => setShowStats(false)} />
            )}
        </div>
    );
}
export default Kpopdle;