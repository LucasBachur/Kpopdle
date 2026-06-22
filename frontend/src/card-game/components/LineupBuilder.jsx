import { useState, useEffect } from 'react';
import { getWeeklySongs, getCollection, saveLineup } from '../services/cardGameApi';
import CardTile from './CardTile';
import styles from './LineupBuilder.module.css';

export default function LineupBuilder({ genderCategory, onSaved }) {
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [cards, setCards] = useState([]);
  const [slots, setSlots] = useState([]); // array indexed 0..(memberCount-1), each is playerCard or null
  const [pickerSlot, setPickerSlot] = useState(null); // which slot index is open for card picking
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getWeeklySongs(genderCategory)
      .then(data => setSongs(data.songs || []))
      .catch(err => setError(err.message));
    getCollection()
      .then(data => setCards(data.cards || []))
      .catch(() => {});
  }, [genderCategory]);

  function chooseSong(song) {
    setSelectedSong(song);
    setSlots(Array(song.memberCount).fill(null));
    setPickerSlot(null);
    setNotice(null);
  }

  function assignCard(card) {
    if (pickerSlot === null) return;
    // Remove card from any other slot first
    const updated = slots.map((s, i) =>
      i === pickerSlot ? card : (s?.playerCardId === card.playerCardId ? null : s)
    );
    setSlots(updated);
    setPickerSlot(null);
  }

  function clearSlot(idx) {
    const updated = [...slots];
    updated[idx] = null;
    setSlots(updated);
    setPickerSlot(null);
  }

  async function handleSave() {
    if (!selectedSong) return;
    const filled = slots.filter(Boolean);
    if (filled.length !== selectedSong.memberCount) {
      setError('Fill all slots before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = slots.map((card, i) => ({
        slotPosition: i + 1,
        playerCardId: card.playerCardId,
      }));
      const result = await saveLineup(genderCategory, selectedSong.songId, payload);
      setNotice(result.notice || 'Lineup saved!');
      if (onSaved) onSaved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const usedIds = new Set(slots.filter(Boolean).map(c => c.playerCardId));
  const availableCards = pickerSlot !== null
    ? cards.filter(c => !usedIds.has(c.playerCardId) || slots[pickerSlot]?.playerCardId === c.playerCardId)
    : [];

  return (
    <div className={styles.builder}>
      {/* Song picker */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Pick a Song</h3>
        <div className={styles.songList}>
          {songs.map(song => (
            <button
              key={song.songId}
              className={`${styles.songBtn} ${selectedSong?.songId === song.songId ? styles.songActive : ''}`}
              onClick={() => chooseSong(song)}
            >
              <span className={styles.songTitle}>{song.title}</span>
              <span className={styles.songMeta}>{song.group} · {song.memberCount}p</span>
            </button>
          ))}
          {songs.length === 0 && <p className={styles.empty}>No songs in this week's pool.</p>}
        </div>
      </section>

      {/* Slot filler */}
      {selectedSong && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Lineup for "{selectedSong.title}" ({selectedSong.memberCount} slots)
          </h3>
          <div className={styles.slotRow}>
            {slots.map((card, idx) => (
              <div key={idx} className={styles.slot}>
                <span className={styles.slotLabel}>#{idx + 1}</span>
                {card ? (
                  <div className={styles.slotFilled}>
                    <CardTile card={card} selected={pickerSlot === idx} onClick={() => setPickerSlot(idx)} />
                    <button className={styles.clearBtn} onClick={() => clearSlot(idx)}>×</button>
                  </div>
                ) : (
                  <button
                    className={`${styles.emptySlot} ${pickerSlot === idx ? styles.slotOpen : ''}`}
                    onClick={() => setPickerSlot(pickerSlot === idx ? null : idx)}
                  >
                    {pickerSlot === idx ? 'picking...' : '+ Add'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Card picker panel */}
      {pickerSlot !== null && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Choose card for slot #{pickerSlot + 1}</h3>
          <div className={styles.cardGrid}>
            {availableCards.map(card => (
              <CardTile
                key={card.playerCardId}
                card={card}
                onClick={() => assignCard(card)}
              />
            ))}
            {availableCards.length === 0 && (
              <p className={styles.empty}>No cards available.</p>
            )}
          </div>
        </section>
      )}

      {error && <p className={styles.error}>{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      {selectedSong && (
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving || slots.filter(Boolean).length !== selectedSong.memberCount}
        >
          {saving ? 'Saving...' : 'Save Lineup'}
        </button>
      )}
    </div>
  );
}
