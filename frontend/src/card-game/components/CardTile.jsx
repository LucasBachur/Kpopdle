import { useState } from 'react';
import styles from './CardTile.module.css';

const RARITY_LABEL = { rare: 'R', super_rare: 'SR', ultra_rare: 'UR' };
const RARITY_BADGE_STYLE = {
  rare:       { background: '#888',    color: '#fff' },
  super_rare: { background: '#a855f7', color: '#fff' },
  ultra_rare: { background: '#f59e0b', color: '#000' },
};

export default function CardTile({ card, selected, onClick }) {
  const rarity = card.rarity || 'rare';
  const [imgError, setImgError] = useState(false);
  return (
    <button
      className={`${styles.tile} ${styles[rarity.replace('_', '-')]} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      aria-pressed={selected}
      title={`${card.idolName} — ${card.group}`}
    >
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
      <div className={styles.badge} style={RARITY_BADGE_STYLE[rarity]}>{RARITY_LABEL[rarity]}</div>
      <div className={styles.info}>
        <span className={styles.name}>{card.idolName}</span>
        <span className={styles.stat}>{card.currentStat ?? card.baseStat}</span>
      </div>
    </button>
  );
}
