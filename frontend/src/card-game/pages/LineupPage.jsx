import { useState, useEffect } from 'react';
import { getLineup } from '../services/cardGameApi';
import LineupBuilder from '../components/LineupBuilder';
import styles from './LineupPage.module.css';

const RARITY_LABEL = { rare: 'R', super_rare: 'SR', ultra_rare: 'UR' };
const RARITY_CHIP_STYLE = {
  rare:       { background: '#888',    color: '#fff' },
  super_rare: { background: '#a855f7', color: '#fff' },
  ultra_rare: { background: '#f59e0b', color: '#000' },
};

export default function LineupPage() {
  const [currentLineup, setCurrentLineup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getLineup('gg')
      .then(data => setCurrentLineup(data.lineup))
      .catch(() => setCurrentLineup(null))
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(result) {
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>GG Lineup</h1>

      {!loading && currentLineup && (
        <div className={styles.current}>
          <h2 className={styles.subtitle}>Current Lineup</h2>
          <p className={styles.info}>
            Song: <strong>{currentLineup.song.title}</strong> by {currentLineup.song.group}
          </p>
          <div className={styles.slots}>
            {currentLineup.slots.map(slot => (
              <div key={slot.slotPosition} className={styles.slotCard}>
                <span className={styles.slotNum}>#{slot.slotPosition}</span>
                {slot.rarity && (
                  <span className={styles.rarityChip} style={RARITY_CHIP_STYLE[slot.rarity]}>
                    {RARITY_LABEL[slot.rarity]}
                  </span>
                )}
                <span className={styles.slotName}>{slot.idolName}</span>
                <span className={styles.slotStat}>{slot.currentStat}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {saved && <p className={styles.savedMsg}>Lineup saved!</p>}

      <h2 className={styles.subtitle}>Edit Lineup</h2>
      <LineupBuilder genderCategory="gg" onSaved={handleSaved} />
    </div>
  );
}
