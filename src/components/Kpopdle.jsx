import './Kpopdle.css';
import { useEffect, useState, useRef } from 'react';

function GuessField({field, value, answerValue}){
    let classes = '';
    if(value === answerValue){
        classes = ' correct';
    }
    else{
        classes = ' incorrect';
        if(field === 'birthYear' && value){
            classes += value < answerValue ? ' year-up' : ' year-down';
        }
    }
    return(
        <div className={'guess-item'+classes}>{value}</div>
    );
}

function Guess({ guess, answer }) {
    const fields = ["name", "group", "birthYear", "nationality", "company", "groupType"];

    return (
        <div className='guess-container'>
            {fields.map((field) => (
            <GuessField key={field} field={field} value={guess[field]} answerValue={answer[field]}/>
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

function GuessInput({idolDataForMode, guesses, victory, setGuesses, setVictory, answerId}) {
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
            setVictory(guessedIdol.id === answerId);
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

function Kpopdle({ idolData, answer, mode}) {
    const [guesses, setGuesses] = useState([]);
    const [victory, setVictory] = useState(false);
    const bottomRef = useRef(null);

    let idolDataForMode = (mode != 'All') ? idolData.filter(idol => idol.groupType === mode) : idolData;

    useEffect(() => {
        setGuesses([]);
        setVictory(false);
    },[mode]);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [guesses]);

    return (
        <div className='kpopdle-container'>
            <GuessInput 
                idolDataForMode={idolDataForMode}
                guesses={guesses}
                victory={victory}
                setGuesses={setGuesses}
                setVictory={setVictory}
                answerId={answer.id}
            />
            <GuessList guesses={guesses} answer={answer}/>
            <div ref={bottomRef} />
        </div>
    );
}
export default Kpopdle;