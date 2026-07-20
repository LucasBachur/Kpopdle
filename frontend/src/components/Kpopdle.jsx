import styles from './Kpopdle.module.css';
import { useEffect, useState, useRef } from 'react';
import { todayArg, useStats } from '../utils.js';
import GuessInput from './GuessInput.jsx';
import StatsModal from './StatsModal.jsx';
import ModeSelector from './ModeSelector.jsx';
import Confetti from 'react-confetti';

const MS_PER_YEAR = 3.15576e+10;
const getAge = birthDate => Math.floor((new Date() - new Date(birthDate).getTime()) / MS_PER_YEAR);
const getStorageKey = (mode) => `kpopdle_guesses_${mode}_${todayArg()}`;

function RowImage({ id, name }) {
  const [err, setErr] = useState(false);
  return (
    <div className={styles.imgCell}>
      {!err ? (
        <img src={`/idol-images/${id}.webp`} alt={name} className={styles.img} onError={() => setErr(true)} />
      ) : (
        <span className={styles.imgInitial}>{name?.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

function Cell({ match, label, arrow }) {
  return (
    <div className={`${styles.cell} ${match ? styles.correct : styles.incorrect}`}>
      {arrow && <span className={styles.arrow}>{arrow}</span>}
      <span className={styles.cellLabel}>{label}</span>
    </div>
  );
}

function Kpopdle({ idolData, answer, mode, setMode }) {
  const [guesses, setGuesses] = useState([]);
  const [victory, setVictory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [loadedMode, setLoadedMode] = useState(null);
  const bottomRef = useRef(null);
  const { stats, registerGame } = useStats('kpopdleStats', mode);

  const idolDataForMode = (mode !== 'All') ? idolData.filter(idol => idol.groupType === mode) : idolData;
  const isAll = mode === 'All';
  const headers = ['Name', 'Group', 'Age', 'Nationality', 'Company', ...(isAll ? ['Group Type'] : [])];

  useEffect(() => {
    const saved = localStorage.getItem(getStorageKey(mode));
    if (saved) {
      const parsed = JSON.parse(saved);
      setGuesses(parsed);
      setVictory(parsed.some(g => g.id === answer.id));
    } else {
      setGuesses([]);
      setVictory(false);
    }
    setLoadedMode(mode);
  }, [mode, answer]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [guesses]);

  useEffect(() => {
    if (loadedMode !== mode) return;
    localStorage.setItem(getStorageKey(mode), JSON.stringify(guesses));
  }, [guesses, mode, loadedMode]);

  function suggestionTag(idol) {
    const isGG = idol.groupType === 'Girl Group';
    return (
      <>
        <span className={styles.sugAvatar}>{idol.name.charAt(0).toUpperCase()}</span>
        <span className={styles.sugName}>{idol.name}</span>
        <span className={styles.sugGroup}>{idol.group}</span>
        <span className={`${styles.sugTag} ${isGG ? styles.tagGg : styles.tagBg}`}>{isGG ? 'GG' : 'BG'}</span>
      </>
    );
  }

  const gridStyle = { gridTemplateColumns: `116px repeat(${headers.length}, 116px)` };

  return (
    <div className={styles.page}>
      {victory && (
        <div className={styles.confetti}>
          <Confetti width={window.innerWidth} height={window.innerHeight} />
        </div>
      )}

      <div className={styles.wrap}>
        <div className={styles.header}>
          <h1 className={styles.title}>Kpopdle</h1>
          <div className={styles.modeSlot}><ModeSelector setMode={setMode} currentMode={mode} /></div>
        </div>

        <div className={styles.guessBar}>
          <GuessInput
            data={idolDataForMode}
            guesses={guesses}
            victory={victory}
            setGuesses={setGuesses}
            setVictory={setVictory}
            answer={answer}
            getSearchTerms={idol => [idol.name, idol.group]}
            renderSuggestion={suggestionTag}
            onCorrectGuess={count => registerGame(count)}
          />
          <button className={styles.statsBtn} onClick={() => setShowStats(true)} title="Statistics">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3.5" y="12" width="4.2" height="8" rx="1.4" fill="#66a84e" />
              <rect x="9.9" y="7" width="4.2" height="13" rx="1.4" fill="#f5c43d" />
              <rect x="16.3" y="4" width="4.2" height="16" rx="1.4" fill="#9b5de5" />
            </svg>
          </button>
        </div>

        {victory && (
          <div className={styles.winBanner}>
            <span className={styles.winTrophy}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M4 8l4 3 4-6 4 6 4-3-1.6 10H5.6L4 8z" /></svg>
            </span>
            <span className={styles.winText}>Solved in {guesses.length} — it was {answer.name}!</span>
          </div>
        )}

        <div className={styles.board}>
          <div className={styles.headerRow} style={gridStyle}>
            <div />
            {headers.map(h => <div key={h} className={styles.headerPill}>{h}</div>)}
          </div>

          {guesses.length === 0 ? (
            <div className={styles.emptyState}>
              Type an idol above to start narrowing it down — <span className={styles.green}>green</span> means a match.
            </div>
          ) : (
            <div className={styles.rows}>
              {guesses.map((g, i) => {
                const ansAge = getAge(answer.birthDate);
                const gAge = getAge(g.birthDate);
                const ageMatch = gAge === ansAge;
                return (
                  <div key={i} className={styles.row} style={gridStyle}>
                    <RowImage id={g.id} name={g.name} />
                    <Cell match={g.name === answer.name} label={g.name} />
                    <Cell match={g.group === answer.group} label={g.group} />
                    <Cell match={ageMatch} label={gAge} arrow={ageMatch ? null : (ansAge > gAge ? '▲' : '▼')} />
                    <Cell match={g.nationality === answer.nationality} label={g.nationality} />
                    <Cell match={g.company === answer.company} label={g.company} />
                    {isAll && <Cell match={g.groupType === answer.groupType} label={g.groupType} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {showStats && <StatsModal stats={stats} onClose={() => setShowStats(false)} nextLabel="NEXT KPOPDLE" />}
    </div>
  );
}

export default Kpopdle;
