import styles from './GachaModal.module.css';

const RARITY_LABEL = { rare: 'R', super_rare: 'SR', ultra_rare: 'UR' };
const RARITY_COLOR = { rare: '#60a5fa', super_rare: '#a78bfa', ultra_rare: '#fbbf24' };

function ResultBadge({ card }) {
  if (card.isNew) return <span className={`${styles.badge} ${styles.new}`}>New!</span>;
  if (card.wasUpgrade) return <span className={`${styles.badge} ${styles.upgrade}`}>+1 stat</span>;
  return <span className={`${styles.badge} ${styles.overflow}`}>Overflow</span>;
}

export default function GachaModal({ title = 'Pack Results', results, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.cards}>
          {results.map((card, i) => (
            <div
              key={i}
              className={styles.card}
              style={{ borderTopColor: RARITY_COLOR[card.rarity] }}
            >
              <span className={styles.rarityBadge} style={{ color: RARITY_COLOR[card.rarity] }}>
                {RARITY_LABEL[card.rarity]}
              </span>
              <span className={styles.idolName}>{card.idolName}</span>
              <span className={styles.group}>{card.group}</span>
              <ResultBadge card={card} />
            </div>
          ))}
        </div>
        <button className={styles.closeBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
