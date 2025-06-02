import './Kpopdle.css';
import { useEffect, useState, useRef } from 'react';
import Confetti from 'react-confetti';

const getAge = birthDate => Math.floor((new Date() - new Date(birthDate).getTime()) / 3.15576e+10)

function GuessLabels({mode}) {
    const fields = ["Name", "Group", "Age", "Nationality", "Company"];
    if (mode === 'All') {
        fields.push("Group Type");
    }
    return (
        <div className="guess-container labels-row">
            {fields.map(field => (
                <div key={field} className="label-item">
                    {field}
                </div>
            ))}
        </div>
    );
}

function GuessField({field, value, answerValue}){
    let classes = '';
    let displayValue = value;
    if(value === answerValue){
        classes = ' correct';
    }
    else{
        classes = ' incorrect';
        if(field === 'birthDate' && value){
            classes += value < answerValue ? ' year-up' : ' year-down';
            displayValue = getAge(value);
        }
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
            {fields.map((field) => (
            <GuessField key={field} field={field} value={guess[field]} answerValue={answer[field]}/>
            ))}
        </div>
    );
}

function GuessList({ guesses, answer, mode }) {
    return (
        <div>
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

function GuessInput({idolDataForMode, guesses, victory, setGuesses, setVictory, answer}) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [inputValue, setInputValue] = useState('');
    const suggestionRefs = useRef([]);

    let filteredSuggestions = idolDataForMode.filter(idol =>
        normalizeString(idol.name).includes(normalizeString(inputValue)) && !guesses.some(guess => guess.id == idol.id)
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
const defaultGuesses = [];

function Kpopdle({ idolData, answer, mode}) {

    const [guesses, setGuesses] = useState(defaultGuesses);
    const [victory, setVictory] = useState(false);
    const bottomRef = useRef(null);

    let idolDataForMode = (mode != 'All') ? idolData.filter(idol => idol.groupType === mode) : idolData;

    const getStorageKey = (mode) => {
        const today = new Date().toISOString().split('T')[0]; // e.g., "2025-05-28"
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
            <GuessInput 
                idolDataForMode={idolDataForMode}
                guesses={guesses}
                victory={victory}
                setGuesses={setGuesses}
                setVictory={setVictory}
                answer={answer}
            />
            <GuessList 
                guesses={guesses} 
                answer={answer}
                mode={mode}
            />
            <div ref={bottomRef} />
        </div>
    );
}
export default Kpopdle;