import './Kpopdle.css';
import { useEffect, useState, useRef } from 'react';

function GuessField({value, answerValue}){
    return(
        <div className={`guess ${value === answerValue ? 'correct' : 'incorrect'}`}>{value}</div>
    );
}

function Guess({ guess, answer }) {
    const fields = ["name", "group", "birthYear", "nationality", "company", "groupType"];

    return (
        <div className='guess-container'>
            {fields.map((field) => (
            <GuessField key={field} value={guess[field]} answerValue={answer[field]}/>
            ))}
        </div>
    );
}

function GuessList({ guesses, answer }) {
    return (
        <div>
            {guesses.map((guess) => {
                return <Guess guess={guess} answer={answer}/>;
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


function Kpopdle({ idolData, answers, mode}) {

    const [guesses, setGuesses] = useState([]);
    const [victory, setVictory] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [inputValue, setInputValue] = useState('');
    const idolDataFiltered = (mode != 'All') ? idolData.filter(idol => idol.groupType === mode) : idolData;
    const idolNames = idolDataFiltered.map((idol) => idol.name);
    const answer = answers[mode];
    const suggestionRefs = useRef(null);
    suggestionRefs.current = [];

    useEffect(() => {
        setGuesses([]);
        setVictory(false);
    },[mode]);

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

    const findIdol = (name) => {
        const idol = idolDataFiltered.find(idol => normalizeString(idol.name) === normalizeString(name));
        return idol ? idol : null;
    }

    const submitGuess = (name) => {
        const guessedIdol = findIdol(name);
        if (guessedIdol.id === answer.id) {
            setVictory(true);
        }
        setGuesses([...guesses, guessedIdol]);
        setInputValue('');
        setShowSuggestions(false);
    }

    const handleKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((prev) => (prev + 1) % idolNames.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((prev) => (prev - 1 + idolNames.length) % idolNames.length);
        } else if (event.key === 'Enter') {
            if (activeIndex >= 0 && activeIndex < idolNames.length) {
                submitGuess(idolNames[activeIndex]);
            } else {
                submitGuess(inputValue);
            }
            setActiveIndex(-1); // reset after submit
        }
    }
    return (
        <div className='kpopdle-container'>
            <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="input-field"
                onKeyDown={handleKeyDown} 
                placeholder="Type your guess"
                disabled={victory}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
            />
            {showSuggestions && (
                <ul className="suggestion-box">
                {idolNames.map((name, index) => (
                    <li key={name} 
                        ref={el => suggestionRefs.current[index] = el}
                        className={"suggestion-item" + ((index === activeIndex) ? ' active' : '')}
                        onMouseDown={() => {submitGuess(name);}}>
                    {name}
                    </li>
                ))}
                </ul>
            )}
            <GuessList guesses={guesses} answer={answer}/>
        </div>
    );
}
export default Kpopdle;