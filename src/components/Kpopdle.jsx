import './Kpopdle.css';
import { useState } from 'react';

function GuessField({value, answerValue}){
    return(
        <div className={`guess ${value === answerValue ? 'correct' : 'incorrect'}`}>{value}</div>
    );
}

function Guess({ guess, answer }) {
    const { name, group, age, nationality } = guess;
    return (
        <div className='guess-container'>
            <GuessField value={name} answerValue={answer.name} />
            <GuessField value={group} answerValue={answer.group} />
            <GuessField value={age} answerValue={answer.age} />
            <GuessField value={nationality} answerValue={answer.nationality} />
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

function Kpopdle({ idolData, answer }) {

    const [guesses, setGuesses] = useState([]);
    const [victory, setVictory] = useState(false);

    const findIdol = (name) => {
        const idol = idolData.find(idol => idol.name.toLowerCase() === name.toLowerCase());
        return idol ? idol : null;
    }

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            const inputValue = event.target.value;
            const guessedIdol = findIdol(inputValue);
            if (guessedIdol.id === answer.id) {
                setVictory(true);
            }
            setGuesses([...guesses, guessedIdol]);
            event.target.value = ''; // Clear the input field after pressing Enter
        }
    }

    return (
        <div className='kpopdle-container'>
            <input type="text" className="input-field" onKeyDown={handleKeyDown} placeholder="Type your guess" disabled={victory}/>
            <GuessList guesses={guesses} answer={answer}/>
        </div>
    );
}
export default Kpopdle;