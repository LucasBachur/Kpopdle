import './Kpopdle.css';
import { useEffect, useState, useRef } from 'react';
import { todayArg, useStats } from '../utils.js'
import GuessInput from './GuessInput.jsx'
import StatsModal from './StatsModal.jsx'
import Confetti from 'react-confetti';

const MS_PER_YEAR = 3.15576e+10;
const getAge = birthDate => Math.floor((new Date() - new Date(birthDate).getTime()) / MS_PER_YEAR)

const getStorageKey = (mode) => `kpopdle_guesses_${mode}_${todayArg()}`;


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
                <img src={`/idol-images/${guess.id}.webp`} alt={guess.name} />
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




function Kpopdle({ idolData, answer, mode}) {

    const [guesses, setGuesses] = useState([]);
    const [victory, setVictory] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [loadedMode, setLoadedMode] = useState(null);
    const bottomRef = useRef(null);
    const { stats, registerGame } = useStats('kpopdleStats', mode);

    let idolDataForMode = (mode != 'All') ? idolData.filter(idol => idol.groupType === mode) : idolData;


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
        setLoadedMode(mode);
    }, [mode, answer]);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [guesses]);

    useEffect(() => {
        if (loadedMode !== mode) return;
        localStorage.setItem(getStorageKey(mode), JSON.stringify(guesses));
    }, [guesses, mode, loadedMode]);

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
                    data={idolDataForMode}
                    guesses={guesses}
                    victory={victory}
                    setGuesses={setGuesses}
                    setVictory={setVictory}
                    answer={answer}
                    getLabel={idol => `${idol.name} (${idol.group})`}
                    getSearchTerms={idol => [idol.name, idol.group]}
                    onCorrectGuess={count => registerGame(count)}
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