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

const RARITY_CEILING = { rare: 85, super_rare: 95, ultra_rare: 99 };
const RARITY_COLOR   = { rare: '#888', super_rare: '#a855f7', ultra_rare: '#f59e0b' };

export default function CollectionPage() {
  const [cards, setCards] = useState([]);
  const [overflow, setOverflow] = useState([]);
  const [rarity, setRarity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [convertingId, setConvertingId] = useState(null);
  const [modalImgError, setModalImgError] = useState(false);

  async function fetchCollection() {
    const colData = await getCollection(rarity ? { rarity } : {});
    return colData;
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchCollection()
      .then(colData => {
        setCards(colData.cards);
        setOverflow(colData.overflowDuplicates ?? []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [rarity]);

  useEffect(() => {
    setModalImgError(false);
  }, [selectedCard?.cardDefId]);

  async function handleConvert(duplicateId, convertTo) {
    setConvertingId(duplicateId);
    try {
      await convertOverflow(duplicateId, convertTo);
      const colData = await fetchCollection();
      setCards(colData.cards);
      setOverflow(colData.overflowDuplicates ?? []);
      setSelectedCard(prev =>
        prev ? colData.cards.find(c => c.cardDefId === prev.cardDefId) ?? prev : null
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setConvertingId(null);
    }
  }

  const cardDups  = selectedCard ? overflow.filter(d => d.cardDefId === selectedCard.cardDefId) : [];
  const canUpgrade = selectedCard && selectedCard.currentStat < RARITY_CEILING[selectedCard.rarity];
  const rarityColor = selectedCard ? RARITY_COLOR[selectedCard.rarity] : null;

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
          <CardTile
            key={card.playerCardId}
            card={card}
            selected={selectedCard?.cardDefId === card.cardDefId}
            onClick={() => setSelectedCard(card)}
          />
        ))}
      </div>

      {selectedCard && (
        <div className={styles.modalOverlay} onClick={() => setSelectedCard(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedCard(null)}>✕</button>

            <div className={styles.modalCardRow}>
              <div className={styles.modalArt}>
                {selectedCard.artPath && !modalImgError ? (
                  <img
                    src={`/cards/${selectedCard.artPath}`}
                    alt={selectedCard.idolName}
                    className={styles.modalImg}
                    onError={() => setModalImgError(true)}
                  />
                ) : (
                  <div className={styles.modalPlaceholder}>{selectedCard.idolName?.[0] ?? '?'}</div>
                )}
              </div>
              <div className={styles.modalInfo}>
                <span className={styles.modalName}>{selectedCard.idolName}</span>
                <span className={styles.modalGroup}>{selectedCard.group}</span>
                <span
                  className={styles.modalRarity}
                  style={{ color: rarityColor, borderColor: rarityColor }}
                >
                  {selectedCard.rarity.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className={styles.modalStat}>
                  Stat: {selectedCard.currentStat} / {RARITY_CEILING[selectedCard.rarity]}
                </span>
              </div>
            </div>

            <div className={styles.dupSection}>
              <h3 className={styles.dupTitle}>
                Pending Duplicates{cardDups.length > 0 ? ` (${cardDups.length})` : ''}
              </h3>
              {cardDups.length === 0 ? (
                <p className={styles.noDups}>None.</p>
              ) : (
                cardDups.map(dup => (
                  <div key={dup.id} className={styles.dupRow}>
                    {canUpgrade && (
                      <button
                        className={styles.actionBtn}
                        disabled={convertingId === dup.id}
                        onClick={() => handleConvert(dup.id, 'upgrade')}
                      >
                        +1 Stat
                      </button>
                    )}
                    <button
                      className={styles.actionBtn}
                      disabled={convertingId === dup.id}
                      onClick={() => handleConvert(dup.id, 'currency')}
                    >
                      → Currency
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.cosmeticBtn}`}
                      disabled={convertingId === dup.id}
                      onClick={() => handleConvert(dup.id, 'cosmetic')}
                    >
                      → Cosmetic
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
