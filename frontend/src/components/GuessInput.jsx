import { useState, useRef, useEffect } from 'react';
import { normalizeString } from '../utils.js';

function GuessInput({ data, guesses, victory, setGuesses, setVictory, answer, getLabel, getSearchTerms, onGuess, onCorrectGuess }) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [inputValue, setInputValue] = useState('');
    const suggestionRefs = useRef([]);

    const filteredSuggestions = data.filter(item =>
        getSearchTerms(item).some(term => normalizeString(term).includes(normalizeString(inputValue)))
        && !guesses.some(guess => guess.id === item.id)
    );

    useEffect(() => {
        setActiveIndex(-1);
    }, [inputValue, data]);

    useEffect(() => {
        if (showSuggestions && activeIndex >= 0 && suggestionRefs.current[activeIndex]) {
            suggestionRefs.current[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [activeIndex, showSuggestions]);

    const submitGuess = (id = null, text = null) => {
        let guessedItem = null;
        if (id) {
            guessedItem = data.find(item => item.id === id);
        } else if (text) {
            const matches = data.filter(item => normalizeString(getSearchTerms(item)[0]) === normalizeString(text));
            if (matches.length === 1) guessedItem = matches[0];
        }
        if (guessedItem && !guesses.some(guess => guess.id === guessedItem.id)) {
            const isCorrect = guessedItem.id === answer.id;
            setVictory(isCorrect);
            if (isCorrect && onCorrectGuess) onCorrectGuess(guesses.length + 1);
            setGuesses([...guesses, guessedItem]);
            setInputValue('');
            setShowSuggestions(false);
            if (onGuess) onGuess();
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex(prev => (prev + 1) % filteredSuggestions.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
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
                    setShowSuggestions(value.length >= 2);
                }}
                className="input-field"
                onKeyDown={handleKeyDown}
                placeholder="Type your guess"
                disabled={victory}
                onFocus={() => setShowSuggestions(inputValue.length >= 2)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className="suggestion-box">
                    {filteredSuggestions.map((item, index) => (
                        <li
                            key={item.id}
                            ref={el => suggestionRefs.current[index] = el}
                            className={"suggestion-item" + (index === activeIndex ? ' active' : '')}
                            onMouseDown={() => submitGuess(item.id, null)}
                        >
                            {getLabel(item)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default GuessInput;
