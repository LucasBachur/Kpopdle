import { useState, useEffect, useMemo } from 'react';
import { getCollection, convertOverflow } from '../services/cardGameApi';
import CardTile from '../components/CardTile';
import styles from './CollectionPage.module.css';

// Canonical rarity → dot color (SR gold, UR purple). The design prototype had the
// SR/UR pill dots swapped; the handoff calls for fixing them to match the card border.
const RARITIES = [
  { value: '',           label: 'All',        dot: null },
  { value: 'rare',       label: 'Rare',       dot: 'var(--cg-rarity-rare)' },
  { value: 'super_rare', label: 'Super Rare', dot: 'var(--cg-rarity-super-rare)' },
  { value: 'ultra_rare', label: 'Ultra Rare', dot: 'var(--cg-rarity-ultra-rare)' },
];

const RARITY_CEILING = { rare: 85, super_rare: 95, ultra_rare: 99 };
const RARITY_COLOR   = {
  rare: 'var(--cg-rarity-rare)',
  super_rare: 'var(--cg-rarity-super-rare)',
  ultra_rare: 'var(--cg-rarity-ultra-rare)',
};

const statOf = (c) => c.currentStat ?? c.baseStat ?? 0;

export default function CollectionPage() {
  const [cards, setCards] = useState([]);
  const [overflow, setOverflow] = useState([]);
  const [rarity, setRarity] = useState('');
  const [query, setQuery] = useState('');
  const [sortDir, setSortDir] = useState('desc'); // by stat
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [convertingId, setConvertingId] = useState(null);
  const [modalImgError, setModalImgError] = useState(false);

  async function loadCollection() {
    // Load the full collection once; filter/sort/search happen client-side.
    return getCollection();
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadCollection()
      .then(colData => {
        setCards(colData.cards);
        setOverflow(colData.overflowDuplicates ?? []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setModalImgError(false);
  }, [selectedCard?.cardDefId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards
      .filter(c => !rarity || c.rarity === rarity)
      .filter(c => !q
        || c.idolName.toLowerCase().includes(q)
        || (c.group && c.group.toLowerCase().includes(q)))
      .sort((a, b) => {
        const diff = statOf(b) - statOf(a);
        const ordered = sortDir === 'asc' ? -diff : diff;
        return ordered !== 0 ? ordered : a.idolName.localeCompare(b.idolName);
      });
  }, [cards, rarity, query, sortDir]);

  async function handleConvert(duplicateId, convertTo) {
    setConvertingId(duplicateId);
    try {
      await convertOverflow(duplicateId, convertTo);
      const colData = await loadCollection();
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

  const cardDups   = selectedCard ? overflow.filter(d => d.cardDefId === selectedCard.cardDefId) : [];
  const canUpgrade = selectedCard && selectedCard.currentStat < RARITY_CEILING[selectedCard.rarity];
  const rarityColor = selectedCard ? RARITY_COLOR[selectedCard.rarity] : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Collection</h1>
      </div>

      <div className={styles.toolbar}>
        {RARITIES.map(r => (
          <button
            key={r.value || 'all'}
            className={`${styles.pill} ${rarity === r.value ? styles.pillActive : ''}`}
            onClick={() => setRarity(rarity === r.value ? '' : r.value)}
          >
            {r.dot && <span className={styles.dot} style={{ background: r.dot }} />}
            {r.label}
          </button>
        ))}

        <button
          className={styles.sortBtn}
          title={`Sort by stat (${sortDir === 'desc' ? 'high → low' : 'low → high'})`}
          onClick={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M5 3v12M5 15l-2.5-2.5M5 15l2.5-2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13 15V3M13 3l-2.5 2.5M13 3l2.5 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className={styles.spacer} />

        <div className={styles.search}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
            <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Search idols or groups…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading && <p className={styles.status}>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {!loading && !error && shown.length === 0 && (
        <p className={styles.status}>No cards found.</p>
      )}

      <div className={styles.grid}>
        {shown.map(card => (
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
              <div className={styles.modalArt} style={{ borderColor: rarityColor }}>
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
