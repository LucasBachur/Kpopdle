import { useState } from 'react';
import styles from './CardTile.module.css';

// Rarity is conveyed only by the card border (design handoff — no rarity badge).
const RARITY_CLASS = { rare: 'rare', super_rare: 'superRare', ultra_rare: 'ultraRare' };

export default function CardTile({ card, selected, onClick }) {
  const rarity = card.rarity || 'rare';
  const [imgError, setImgError] = useState(false);
  return (
    <button
      className={`${styles.tile} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      aria-pressed={selected}
      title={`${card.idolName} — ${card.group}`}
    >
      <div className={`${styles.frame} ${styles[RARITY_CLASS[rarity]]}`}>
        {card.artPath && !imgError ? (
          <img
            src={`/cards/${card.artPath}`}
            alt={`${card.idolName} card art`}
            className={styles.art}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.placeholder}>{card.idolName?.[0] ?? '?'}</div>
        )}
        <div className={styles.scrim}>{card.idolName}</div>
        <div className={styles.stat}>{card.currentStat ?? card.baseStat}</div>
      </div>
    </button>
  );
}
