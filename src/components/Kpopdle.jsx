import './Kpopdle.css';
import { useEffect, useState } from 'react';

function GuessField({value, answerValue}){
    return(
        <div className={`guess ${value === answerValue ? 'correct' : 'incorrect'}`}>{value}</div>
    );
}

function Guess({ guess, answer }) {
    const { name, group, birthYear, nationality, company, groupType } = guess;
    return (
        <div className='guess-container'>
            <GuessField value={name} answerValue={answer.name} />
            <GuessField value={group} answerValue={answer.group} />
            <GuessField value={birthYear} answerValue={answer.birthYear} />
            <GuessField value={nationality} answerValue={answer.nationality} />
            <GuessField value={company} answerValue={answer.company} />
            <GuessField value={groupType} answerValue={answer.groupType} />
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
        .replace(/[-.\s]/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
};


function Kpopdle({ idolData, answers, mode}) {

    const [guesses, setGuesses] = useState([]);
    const [victory, setVictory] = useState(false);
    const idolDataFiltered = (mode != 'All') ? idolData.filter(idol => idol.groupType === mode) : idolData;
    const answer = answers[mode];

    useEffect(() => {
        setGuesses([]);
        setVictory(false);
    },[mode]);

    const findIdol = (name) => {
        const idol = idolDataFiltered.find(idol => normalizeString(idol.name) === normalizeString(name));
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