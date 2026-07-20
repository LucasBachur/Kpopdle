import { useState, useEffect, useMemo } from 'react';
import { getLineup, getWeeklySongs, getCollection, getTodayShows, saveLineup } from '../services/cardGameApi';
import LineupCard from '../components/LineupCard';
import styles from './LineupPage.module.css';

const GENDER = 'gg';

const slotsLabel = (n) => `${n} ${n === 1 ? 'slot' : 'slots'}`;
const isSynergy = (label) => /synerg|chemist|group/i.test(label);
const cleanLabel = (label) => label.replace(/^\+\s*/, '');

// Build a size-N slot array from a saved lineup, resolving each slot to its
// collection card (falling back to the lineup slot's own fields).
function buildSlots(lineup, collection) {
  const size = lineup.song.memberCount;
  const arr = Array(size).fill(null);
  for (const slot of lineup.slots) {
    const card =
      collection.find(c => c.playerCardId === slot.playerCardId) || {
        playerCardId: slot.playerCardId,
        cardDefId: slot.cardDefId,
        idolName: slot.idolName,
        rarity: slot.rarity,
        currentStat: slot.currentStat,
        artPath: slot.artPath,
      };
    if (slot.slotPosition >= 1 && slot.slotPosition <= size) arr[slot.slotPosition - 1] = card;
  }
  return arr;
}

export default function LineupPage() {
  const [songs, setSongs] = useState([]);
  const [cards, setCards] = useState([]);
  const [savedLineup, setSavedLineup] = useState(null);
  const [boosts, setBoosts] = useState([]);
  const [showName, setShowName] = useState('');
  const [loading, setLoading] = useState(true);

  const [screen, setScreen] = useState('view'); // 'view' | 'edit'
  const [selectedSong, setSelectedSong] = useState(null);
  const [slots, setSlots] = useState([]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [showSongList, setShowSongList] = useState(false);
  const [pendingSong, setPendingSong] = useState(null); // song awaiting discard-confirm
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    Promise.all([
      getWeeklySongs(GENDER).catch(() => ({ songs: [] })),
      getCollection().catch(() => ({ cards: [] })),
      getLineup(GENDER).catch(() => ({ lineup: null })),
      getTodayShows().catch(() => ({ multiplierLabels: [], shows: [] })),
    ]).then(([songData, colData, lineupData, showData]) => {
      const songList = songData.songs || [];
      const collection = colData.cards || [];
      const lineup = lineupData.lineup || null;
      setSongs(songList);
      setCards(collection);
      setSavedLineup(lineup);
      setBoosts(showData.multiplierLabels || []);
      const ggShow = (showData.shows || []).find(s => s.genderCategory === GENDER) || (showData.shows || [])[0];
      if (ggShow?.date) {
        const weekday = new Date(`${ggShow.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
        setShowName(`${weekday} Show`);
      } else {
        setShowName("Today's Show");
      }

      // Seed the editor: prefer the saved lineup's song, else the first weekly song.
      let song = null;
      if (lineup && songList.some(s => s.songId === lineup.song.songId)) {
        song = songList.find(s => s.songId === lineup.song.songId);
      } else if (songList.length) {
        song = songList[0];
      }
      setSelectedSong(song);
      if (song && lineup && lineup.song.songId === song.songId) {
        const seeded = buildSlots(lineup, collection);
        setSlots(seeded);
        setActiveSlot(Math.max(0, seeded.findIndex(x => !x)));
      } else if (song) {
        setSlots(Array(song.memberCount).fill(null));
        setActiveSlot(0);
      }
    }).finally(() => setLoading(false));
  }, []);

  // ── Editor actions ──
  function applySong(song) {
    setSelectedSong(song);
    setSlots(Array(song.memberCount).fill(null));
    setActiveSlot(0);
    setShowSongList(false);
    setPendingSong(null);
    setError(null);
  }

  function chooseSong(song) {
    if (song.songId === selectedSong?.songId) { setShowSongList(false); return; }
    const hasProgress = slots.some(Boolean);
    if (hasProgress) {
      setPendingSong(song);
      setShowSongList(false);
    } else {
      applySong(song);
    }
  }

  function pick(card) {
    if (slots.some(s => s?.playerCardId === card.playerCardId)) return; // one idol per lineup
    const next = [...slots];
    let a = activeSlot;
    if (a < 0 || a >= next.length || next[a]) a = next.findIndex(x => !x);
    if (a === -1) return; // full
    next[a] = card;
    setSlots(next);
    setActiveSlot(next.findIndex(x => !x));
  }

  function clickSlot(i) {
    const next = [...slots];
    if (next[i]) { next[i] = null; setSlots(next); }
    setActiveSlot(i);
  }

  const filled = slots.filter(Boolean).length;
  const total = slots.length;
  const canSave = total > 0 && filled === total;

  async function handleSave() {
    if (!canSave || !selectedSong) return;
    setSaving(true);
    setError(null);
    try {
      const payload = slots.map((card, i) => ({ slotPosition: i + 1, playerCardId: card.playerCardId }));
      await saveLineup(GENDER, selectedSong.songId, payload);
      const fresh = await getLineup(GENDER).catch(() => ({ lineup: null }));
      setSavedLineup(fresh.lineup || null);
      setScreen('view');
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Live group-chemistry preview (Feature 003 — retained; the design leaves room for it).
  const chemistry = useMemo(() => {
    const inLineup = slots.filter(Boolean);
    if (inLineup.length < 2) return [];
    const counts = new Map();
    for (const card of inLineup) {
      if (card.group) counts.set(card.group, (counts.get(card.group) ?? 0) + 1);
    }
    const out = [];
    for (const [group, n] of counts) {
      if (n < 2) continue;
      const gSize = inLineup.find(c => c.group === group)?.groupSize ?? n;
      const ratio = n >= gSize ? 1.0 : 1 - Math.pow(0.5, n - 1);
      out.push({ group, pct: Math.round(ratio * 100) });
    }
    return out;
  }, [slots]);

  const usedIds = new Set(slots.filter(Boolean).map(c => c.playerCardId));

  function BoostChips({ small }) {
    if (boosts.length === 0) return null;
    return boosts.map(label => (
      <span
        key={label}
        className={`${styles.boost} ${isSynergy(label) ? styles.boostSynergy : ''} ${small ? styles.boostSmall : ''}`}
      >
        <span className={styles.boostPlus}>+</span>{cleanLabel(label)}
      </span>
    ));
  }

  if (loading) return <div className={styles.page}><p className={styles.status}>Loading…</p></div>;

  // ══════════════ VIEW ══════════════
  if (screen === 'view') {
    return (
      <div className={styles.page}>
        <div className={styles.viewWrap}>
          <div className={styles.header}>
            <h1 className={styles.title}>My Lineup</h1>
          </div>

          <div className={styles.viewGrid}>
            <div className={styles.lineupPanel}>
              {savedLineup ? (
                <>
                  <div className={styles.songHead}>
                    <div className={styles.songIcon}>
                      <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                        <path d="M7 15.5V5l9-2v10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="5" cy="15.5" r="2" stroke="currentColor" strokeWidth="1.6" />
                        <circle cx="14" cy="13.5" r="2" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </div>
                    <div className={styles.songMeta}>
                      <div className={styles.songKicker}>CURRENT SONG</div>
                      <div className={styles.songTitle}>
                        {savedLineup.song.title}
                        <span className={styles.songGroup}> · {savedLineup.song.group}</span>
                      </div>
                    </div>
                    <div className={styles.slotsBadge}>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M4.5 16c.6-2.8 2.9-4.4 5.5-4.4s4.9 1.6 5.5 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      {slotsLabel(savedLineup.song.memberCount)}
                    </div>
                  </div>
                  <div className={styles.savedGrid}>
                    {savedLineup.slots.map(slot => (
                      <LineupCard
                        key={slot.slotPosition}
                        state="filled"
                        idolName={slot.idolName}
                        stat={slot.currentStat}
                        rarity={slot.rarity}
                        rank={slot.slotPosition}
                        artPath={slot.artPath}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>
                  <p className={styles.emptyTitle}>You haven't set a lineup yet.</p>
                  <p className={styles.emptySub}>Pick a song and fill every slot to compete in today's show.</p>
                </div>
              )}
            </div>

            <div className={styles.sideRail}>
              <div className={styles.boostPanel}>
                <div className={styles.songKicker}>TODAY'S BOOSTS</div>
                <div className={styles.showRow}>
                  <span className={styles.showDot} />
                  <span className={styles.showName}>{showName}</span>
                </div>
                {boosts.length > 0 ? (
                  <div className={styles.boostList}><BoostChips /></div>
                ) : (
                  <p className={styles.boostEmpty}>No bonuses for today's show.</p>
                )}
                <div className={styles.boostNote}>
                  Boosts change per daily show — tweak your lineup to match today's programme.
                </div>
              </div>
              <button className={styles.primaryBtn} onClick={() => setScreen('edit')}>
                {savedLineup ? 'Edit Lineup' : 'Build Lineup'}
              </button>
            </div>
          </div>

          {savedToast && <p className={styles.savedMsg}>Lineup saved!</p>}
        </div>
      </div>
    );
  }

  // ══════════════ EDIT ══════════════
  return (
    <div className={styles.page}>
      <div className={styles.editWrap}>
        <div className={styles.editBar}>
          <button className={styles.backBtn} onClick={() => { setScreen('view'); setShowSongList(false); }} title="Back to overview">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M12 4 6 10l6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className={styles.songSelectWrap}>
            <button className={styles.songSelect} onClick={() => setShowSongList(v => !v)} disabled={!songs.length}>
              <span className={styles.songSelectKicker}>SONG</span>
              {selectedSong ? (
                <>
                  <span className={styles.songSelectTitle}>{selectedSong.title}</span>
                  <span className={styles.songSelectGroup}>{selectedSong.group}</span>
                  <span className={styles.songSelectSlots}>{slotsLabel(selectedSong.memberCount)}</span>
                </>
              ) : (
                <span className={styles.songSelectTitle}>Choose a song</span>
              )}
              <span className={styles.caret}>▾</span>
            </button>
            {showSongList && (
              <div className={styles.songList}>
                <div className={styles.songListKicker}>WEEKLY ROTATION</div>
                {songs.length === 0 && <div className={styles.songListEmpty}>No songs in this week's pool.</div>}
                {songs.map(song => (
                  <div
                    key={song.songId}
                    className={`${styles.songRow} ${song.songId === selectedSong?.songId ? styles.songRowActive : ''}`}
                    onClick={() => chooseSong(song)}
                  >
                    <span className={styles.songRowTitle}>{song.title}</span>
                    <span className={styles.songRowGroup}>{song.group}</span>
                    <span className={styles.songRowSlots}>{song.memberCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.editBoosts}>
            <span className={styles.editBoostKicker}>TODAY · {showName}</span>
            <BoostChips small />
          </div>
        </div>

        <div className={styles.collectionPanel}>
          <div className={styles.collectionHead}>
            Your collection
            <span className={styles.collectionHint}>
              {' '}· tap to add to slot {activeSlot >= 0 && activeSlot < total ? `#${activeSlot + 1}` : '—'}
            </span>
          </div>
          {chemistry.length > 0 && (
            <div className={styles.chemRow}>
              <span className={styles.chemKicker}>CHEMISTRY</span>
              {chemistry.map(({ group, pct }) => (
                <span key={group} className={styles.chemChip}>{group} · {pct}%</span>
              ))}
            </div>
          )}
          <div className={styles.pickerGrid}>
            {cards.map(card => (
              <LineupCard
                key={card.playerCardId}
                state={usedIds.has(card.playerCardId) ? 'pickerDim' : 'picker'}
                idolName={card.idolName}
                stat={card.currentStat ?? card.baseStat}
                rarity={card.rarity}
                artPath={card.artPath}
                onClick={() => pick(card)}
              />
            ))}
            {cards.length === 0 && <p className={styles.status}>No cards in your collection yet.</p>}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.dock}>
          <div className={styles.dockProgress}>
            <div className={styles.dockCount}>{filled} / {total}</div>
            <div className={styles.dockCountLabel}>SLOTS</div>
          </div>
          <div className={styles.dockSlots}>
            {slots.map((slot, i) => (
              <div key={i} className={styles.dockSlot}>
                <LineupCard
                  state={slot ? 'filled' : (i === activeSlot ? 'active' : 'empty')}
                  idolName={slot?.idolName ?? ''}
                  stat={slot ? (slot.currentStat ?? slot.baseStat) : ''}
                  rarity={slot?.rarity ?? 'rare'}
                  rank={i + 1}
                  artPath={slot?.artPath}
                  onClick={() => clickSlot(i)}
                />
              </div>
            ))}
          </div>
          <button
            className={`${styles.submitBtn} ${canSave ? '' : styles.submitDisabled}`}
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? 'Saving…' : 'Submit'}
          </button>
        </div>
      </div>

      {pendingSong && (
        <div className={styles.confirmOverlay} onClick={() => setPendingSong(null)}>
          <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <p className={styles.confirmTitle}>Switch song?</p>
            <p className={styles.confirmText}>
              Changing to <strong>{pendingSong.title}</strong> will clear your current lineup.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setPendingSong(null)}>Cancel</button>
              <button className={styles.confirmDiscard} onClick={() => applySong(pendingSong)}>Discard & switch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
