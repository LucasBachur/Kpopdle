import { useState, useEffect } from 'react';
import { getCollection, convertOverflow } from '../services/cardGameApi';
import CardTile from '../components/CardTile';
import styles from './CollectionPage.module.css';

const RARITIES = [
  { value: '',           label: 'All',        color: null },
  { value: 'rare',       label: 'Rare',       color: '#888' },
  { value: 'super_rare', label: 'Super Rare', color: '#a855f7' },
  { value: 'ultra_rare', label: 'Ultra Rare', color: '#f59e0b' },
];

export default function CollectionPage() {
  const [cards, setCards] = useState([]);
  const [overflow, setOverflow] = useState([]);
  const [rarity, setRarity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [convertingId, setConvertingId] = useState(null);

  async function loadCollection() {
    const colData = await getCollection(rarity ? { rarity } : {});
    setCards(colData.cards);
    setOverflow(colData.overflowDuplicates ?? []);
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadCollection()
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [rarity]);

  async function handleConvert(duplicateId, convertTo) {
    setConvertingId(duplicateId);
    try {
      await convertOverflow(duplicateId, convertTo);
      await loadCollection();
    } catch (err) {
      alert(err.message);
    } finally {
      setConvertingId(null);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>My Collection</h1>

      <div className={styles.filters}>
        {RARITIES.map(r => {
          const isActive = rarity === r.value;
          const inlineStyle = r.color ? {
            borderColor: r.color,
            color: isActive ? '#000' : r.color,
            background: isActive ? r.color : `${r.color}22`,
          } : {};
          return (
            <button
              key={r.value}
              className={`${styles.filter} ${isActive && !r.color ? styles.active : ''}`}
              style={inlineStyle}
              onClick={() => setRarity(r.value)}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {loading && <p className={styles.status}>Loading...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && cards.length === 0 && (
        <p className={styles.status}>No cards found.</p>
      )}

      <div className={styles.grid}>
        {cards.map(card => (
          <CardTile key={card.playerCardId} card={card} />
        ))}
      </div>

      {overflow.length > 0 && (
        <div className={styles.overflowSection}>
          <h2 className={styles.overflowTitle}>Overflow Inventory</h2>
          <p className={styles.overflowSub}>Cards you've pulled when your copy was already at the stat ceiling.</p>
          <div className={styles.overflowList}>
            {overflow.map(dup => (
              <div key={dup.id} className={styles.overflowItem}>
                <span className={styles.overflowName}>{dup.idolName}</span>
                <span className={styles.overflowGroup}>{dup.group}</span>
                <span className={styles.overflowRarity}>{dup.rarity.replace('_', ' ')}</span>
                <button
                  className={styles.convertBtn}
                  disabled={convertingId === dup.id}
                  onClick={() => handleConvert(dup.id, 'currency')}
                >
                  → Currency
                </button>
                <button
                  className={`${styles.convertBtn} ${styles.cosmeticBtn}`}
                  disabled={convertingId === dup.id}
                  onClick={() => handleConvert(dup.id, 'cosmetic')}
                >
                  → Cosmetic
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
