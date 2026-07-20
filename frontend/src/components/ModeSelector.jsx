import { useState, useRef } from 'react';
import styles from './ModeSelector.module.css';

// Real mode values are 'All' | 'Girl Group' | 'Boy Group' (matches groupType).
const MODES = [
  { mode: 'Boy Group',  big: 'BG',  sub: 'Boy Group',  cls: 'bg' },
  { mode: 'All',        big: 'All', sub: 'Everyone',   cls: 'all' },
  { mode: 'Girl Group', big: 'GG',  sub: 'Girl Group', cls: 'gg' },
];

function ModeSelector({ setMode, currentMode }) {
  const [expanded, setExpanded] = useState(false);
  const isHoverDevice = useRef(window.matchMedia('(hover: hover) and (pointer: fine)').matches).current;
  const shown = expanded ? MODES : MODES.filter(m => m.mode === currentMode);

  function handleClick(m) {
    // Touch devices can't hover: first tap expands the collapsed selector.
    if (!expanded && !isHoverDevice) { setExpanded(true); return; }
    setMode(m.mode);
    setExpanded(false);
  }

  return (
    <div
      className={styles.container}
      onMouseEnter={isHoverDevice ? () => setExpanded(true) : undefined}
      onMouseLeave={isHoverDevice ? () => setExpanded(false) : undefined}
    >
      {shown.map(m => (
        <button
          key={m.mode}
          className={`${styles.card} ${styles[m.cls]} ${m.mode === currentMode ? styles.active : ''}`}
          onClick={() => handleClick(m)}
        >
          <span className={styles.big}>{m.big}</span>
          <span className={styles.sub}>{m.sub}</span>
        </button>
      ))}
    </div>
  );
}

export default ModeSelector;
