import { useState } from 'react';
import styles from './LineupCard.module.css';

// Reusable card/slot visual for the Lineup page.
// states: empty | active | filled | picker | pickerDim
const RARITY_CLASS = { rare: 'rare', super_rare: 'superRare', ultra_rare: 'ultraRare' };

export default function LineupCard({
  state = 'picker',
  idolName = '',
  stat = '',
  rarity = 'rare',
  rank,
  artPath,
  onClick,
}) {
  const [imgError, setImgError] = useState(false);
  const hasRank = rank != null && rank !== '';

  if (state === 'empty' || state === 'active') {
    const active = state === 'active';
    return (
      <div
        className={`${styles.slot} ${active ? styles.slotActive : ''}`}
        onClick={onClick}
      >
        {hasRank && <div className={styles.slotRank}>#{rank}</div>}
        <div className={styles.slotLabel}>{active ? 'picking…' : '+ Add'}</div>
      </div>
    );
  }

  const isDim = state === 'pickerDim';
  return (
    <div
      className={`${styles.card} ${styles[RARITY_CLASS[rarity] || 'rare']} ${isDim ? styles.dim : ''}`}
      onClick={isDim ? undefined : onClick}
    >
      {artPath && !imgError ? (
        <img src={`/cards/${artPath}`} alt={idolName} className={styles.art} onError={() => setImgError(true)} />
      ) : (
        <div className={styles.placeholder}>{idolName?.[0] ?? '?'}</div>
      )}
      {hasRank && <div className={styles.rank}>#{rank}</div>}
      <div className={styles.scrim}>{idolName}</div>
      <div className={styles.stat}>{stat}</div>
      {isDim && (
        <div className={styles.dimOverlay}>
          <span className={styles.dimBadge}>In lineup</span>
        </div>
      )}
    </div>
  );
}
