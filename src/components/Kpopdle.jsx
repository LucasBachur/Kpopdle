import './Kpopdle.css';
import { useEffect, useState, useRef } from 'react';

function GuessField({value, answerValue}){
    return(
        <div className={`guess-item ${value === answerValue ? 'correct' : 'incorrect'}`}>{value}</div>
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
            {guesses.map((guess, index) => {
                return <Guess key={index} guess={guess} answer={answer}/>;
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
    const idolDataForMode = (mode != 'All') ? idolData.filter(idol => idol.groupType === mode) : idolData;
    const answer = answers[mode];
    const suggestionRefs = useRef(null);
    const bottomRef = useRef(null);
    const filteredSuggestions = idolDataForMode.filter(idol =>
        normalizeString(idol.name).includes(normalizeString(inputValue))
    );
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

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [guesses]);

    const findIdol = (name) => {
        const idol = idolDataForMode.find(idol => normalizeString(idol.name) === normalizeString(name));
        return idol ? idol : null;
    }

    const submitGuess = (name) => {
        const guessedIdol = findIdol(name);
        if (guessedIdol) {
            if (guessedIdol.id === answer.id) {
                setVictory(true);
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
                submitGuess(filteredSuggestions[activeIndex].name);
            } else {
                submitGuess(inputValue);
            }
            setActiveIndex(-1); // reset after submit
        }
    }
    return (
        <div className='kpopdle-container'>
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
                            onMouseDown={() => {submitGuess(idol.name);}}>
                        {idol.name+ " ("+idol.group+")"}
                        </li>
                    ))}
                    </ul>
                )}
            </div>
            <GuessList guesses={guesses} answer={answer}/>
            <div ref={bottomRef} />
        </div>
    );
}
export default Kpopdle;