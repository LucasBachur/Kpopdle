import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMe, getTodayShows, getLeaderboard, getLeaderboardHistory, getLineup,
} from '../services/cardGameApi';
import styles from './LeaderboardPage.module.css';

const GENDER = 'gg';

const RARITY_BORDER = {
  rare: 'var(--cg-rarity-rare)',
  super_rare: 'var(--cg-rarity-super-rare)',
  ultra_rare: 'var(--cg-rarity-ultra-rare)',
};
const RARITY_LABEL = { rare: 'R', super_rare: 'SR', ultra_rare: 'UR' };

// medal styling for ranks 1/2/3
const MEDAL = [
  { bg: 'rgba(245,196,61,.9)',  color: '#5a4410', border: 'var(--cg-rarity-super-rare)' },
  { bg: 'rgba(196,200,212,.9)', color: '#3a3340', border: 'var(--cg-rarity-rare)' },
  { bg: 'rgba(214,154,92,.85)', color: '#3a3340', border: '#d69a5c' },
];

function weekdayShowName(date) {
  if (!date) return "Today's Show";
  return `${new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })} Show`;
}

function fmtCountdown(deadline) {
  if (!deadline) return null;
  const ms = new Date(deadline) - Date.now();
  if (ms <= 0) return '00:00:00';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  if (d > 0) {
    const h = Math.floor((totalMin % 1440) / 60);
    return `${d}d ${h}h`;
  }
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState('live'); // 'live' | 'archive'
  const [me, setMe] = useState(null);
  const [myLineup, setMyLineup] = useState(null);
  const [todayShow, setTodayShow] = useState(null);
  const [boosts, setBoosts] = useState([]);
  const [live, setLive] = useState(null); // leaderboard payload for today's show
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [history, setHistory] = useState(null);
  const [archiveView, setArchiveView] = useState('list'); // 'list' | 'detail'
  const [selected, setSelected] = useState(null); // history row
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [, setTick] = useState(0);

  // Live-score reveal: animate scores up to their real resolved values (cosmetic).
  const [revealT, setRevealT] = useState(1); // 1 = fully shown
  const [revealing, setRevealing] = useState(false);
  const rafRef = useRef(null);

  useEffect(() => {
    Promise.all([
      getMe().catch(() => null),
      getTodayShows().catch(() => ({ shows: [], multiplierLabels: [] })),
      getLineup(GENDER).catch(() => ({ lineup: null })),
    ]).then(async ([meData, showData, lineupData]) => {
      setMe(meData);
      setMyLineup(lineupData.lineup || null);
      setBoosts(showData.multiplierLabels || []);
      const ggShow = (showData.shows || []).find(s => s.genderCategory === GENDER) || (showData.shows || [])[0] || null;
      setTodayShow(ggShow);
      if (ggShow) {
        try {
          setLive(await getLeaderboard(ggShow.id));
        } catch { /* leaderboard optional */ }
      }
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);

  // 1s tick for the pre-show countdown
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const loadHistory = useCallback(() => {
    if (history) return;
    getLeaderboardHistory(GENDER, 30, 0)
      .then(data => setHistory(data.history || []))
      .catch(err => setError(err.message));
  }, [history]);

  useEffect(() => { if (tab === 'archive') loadHistory(); }, [tab, loadHistory]);

  function openDetail(row) {
    setSelected(row);
    setArchiveView('detail');
    setDetail(null);
    setDetailLoading(true);
    getLeaderboard(row.showId)
      .then(setDetail)
      .catch(err => setError(err.message))
      .finally(() => setDetailLoading(false));
  }

  const resolved = todayShow?.resolutionStatus === 'resolved';
  const showName = weekdayShowName(todayShow?.date);
  const entries = live?.leaderboard ?? [];
  const isRegistered = live?.autoEntryStatus?.isRegistered ?? !!myLineup;

  const startReveal = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const DURATION = 2600;
    const t0 = performance.now();
    setRevealing(true);
    setRevealT(0);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / DURATION);
      setRevealT(t);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else setRevealing(false);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  // Auto-play the reveal once per resolved show (localStorage-gated); otherwise show finals.
  useEffect(() => {
    if (todayShow?.resolutionStatus !== 'resolved' || !live) return;
    const key = `cg_show_revealed_${todayShow.id}`;
    if (localStorage.getItem(key)) { setRevealT(1); return; }
    localStorage.setItem(key, '1');
    startReveal();
  }, [live, todayShow, startReveal]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Score as displayed during the reveal — eased with per-entry wobble, landing exactly on `score`.
  function displayScore(score, seed) {
    if (revealT >= 1 || score == null) return score;
    const eased = 1 - Math.pow(1 - revealT, 3);
    const wobble = 1 - (1 - revealT) * 0.16 * Math.abs(Math.sin(revealT * (6 + (seed * 3) % 9) + seed));
    return Math.max(0, Math.round(score * eased * wobble));
  }

  function MiniLineup() {
    const slots = myLineup?.slots ?? [];
    if (!slots.length) return null;
    return (
      <div className={styles.miniRow}>
        {slots.map(s => (
          <div key={s.slotPosition} className={styles.mini} style={{ borderColor: RARITY_BORDER[s.rarity] }} />
        ))}
      </div>
    );
  }

  function Podium({ top3, light }) {
    // stage order: 2nd, 1st, 3rd
    const order = [1, 0, 2];
    return (
      <div className={styles.podium}>
        {order.map(rk => {
          const e = top3[rk];
          if (!e) return <div key={rk} className={styles.podiumCol} />;
          const medal = MEDAL[rk];
          return (
            <div key={rk} className={styles.podiumCol}>
              <div className={`${styles.podiumCard} ${light ? styles.podiumCardLight : ''}`} style={{ borderColor: medal.border }}>
                <div className={styles.podiumPhoto}>PHOTO</div>
                <div className={styles.podiumRank} style={{ background: medal.bg, color: medal.color }}>{e.rank}</div>
              </div>
              <div className={`${styles.podiumName} ${light ? styles.podiumNameLight : ''}`}>{e.username}</div>
              <div className={`${styles.podiumSong} ${light ? styles.podiumSongLight : ''}`}>{e.songTitle}</div>
            </div>
          );
        })}
      </div>
    );
  }

  if (loading) return <div className={styles.page}><p className={styles.status}>Loading…</p></div>;

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.headerCol}>
          <h1 className={styles.title}>Shows</h1>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'live' ? styles.tabActive : ''}`} onClick={() => setTab('live')}>
              <span className={styles.liveDot} />Live
            </button>
            <button className={`${styles.tab} ${tab === 'archive' ? styles.tabActive : ''}`} onClick={() => setTab('archive')}>
              Archive
            </button>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {/* ══════════ LIVE ══════════ */}
        {tab === 'live' && (
          <div className={styles.liveGrid}>
            <div className={styles.liveMain}>
              {!todayShow ? (
                <div className={styles.darkPanel}><p className={styles.emptyDark}>No show scheduled today. Check back soon.</p></div>
              ) : !resolved ? (
                <div className={styles.preshow}>
                  <div className={styles.preshowBar} />
                  <div className={styles.preshowKicker}>TONIGHT'S SHOW</div>
                  <div className={styles.preshowName}>{showName}</div>
                  <div className={styles.preshowSub}>Auto-resolves at the daily deadline</div>
                  <div className={styles.preshowCdLabel}>RESULTS IN</div>
                  <div className={styles.preshowCd}>{fmtCountdown(todayShow.deadline) ?? '—'}</div>
                  {boosts.length > 0 && (
                    <div className={styles.preshowBoosts}>
                      <span className={styles.preshowBoostKicker}>TONIGHT'S BOOSTS</span>
                      {boosts.map(b => <span key={b} className={styles.boostChip}>+{b.replace(/^\+\s*/, '')}</span>)}
                    </div>
                  )}
                  <div className={`${styles.lockChip} ${isRegistered ? '' : styles.lockChipOff}`}>
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                      <path d="M6 10.5l3 3 5.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {isRegistered ? 'Your lineup is locked in' : 'No lineup entered for tonight'}
                  </div>
                </div>
              ) : (
                <div className={styles.darkPanel}>
                  {entries[0] && (
                    <div className={styles.winner}>
                      <div className={styles.trophy}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M4 8l4 3 4-6 4 6 4-3-1.6 10H5.6L4 8z" /></svg>
                      </div>
                      <div className={styles.winnerKicker}>WINNER OF THE NIGHT</div>
                      <div className={styles.winnerName}>{entries[0].username}</div>
                      <div className={styles.winnerSong}>{entries[0].songTitle}</div>
                      <div className={styles.winnerScore}>{displayScore(entries[0].score, 0)?.toLocaleString()} pts</div>
                    </div>
                  )}
                  {entries.length > 0 && <Podium top3={entries.slice(0, 3)} />}
                  <div className={styles.rankList}>
                    <div className={styles.rankHead}>
                      <span className={styles.rankKicker}>FULL RANKING</span>
                      {revealing ? (
                        <span className={styles.tallying}><span className={styles.tallyDot} />TALLYING LIVE</span>
                      ) : (
                        <button className={styles.replayBtn} onClick={startReveal}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          Replay
                        </button>
                      )}
                    </div>
                    {entries.map(e => (
                      <div key={e.rank} className={`${styles.rankRow} ${e.isMe ? styles.rankRowMe : ''}`}>
                        <span className={styles.rankNum}>{e.rank}</span>
                        <span className={styles.rankName}>{e.username}{e.isMe && <span className={styles.youTag}>YOU</span>}</span>
                        <span className={styles.rankSong}>{e.songTitle}</span>
                        <span className={styles.rankScore}>{displayScore(e.score, e.rank)?.toLocaleString()}</span>
                        {e.rewardRarity && <span className={styles.rankReward} style={{ color: RARITY_BORDER[e.rewardRarity] }}>{RARITY_LABEL[e.rewardRarity]}</span>}
                      </div>
                    ))}
                    {entries.length === 0 && <p className={styles.emptyDark}>No entries were submitted for this show.</p>}
                  </div>
                </div>
              )}
            </div>

            {/* right rail: your card */}
            <div className={styles.rail}>
              <div className={styles.railKicker}>{resolved ? 'YOUR RESULT' : 'YOUR LINEUP'}</div>
              <div className={styles.railUser}>
                <div className={styles.railAvatar}>{(me?.username ?? '?').charAt(0).toUpperCase()}</div>
                <div className={styles.railUserMeta}>
                  <div className={styles.railHandle}>{me?.username ?? '—'}</div>
                  <div className={styles.railSong}>{myLineup?.song?.title ?? 'No lineup set'}</div>
                </div>
              </div>
              {resolved && live?.myEntry && (
                <div className={styles.railRankBox}>
                  <div className={styles.railRank}>#{live.myEntry.rank}</div>
                  <div className={styles.railRankSub}>of {entries.length} lineups</div>
                </div>
              )}
              <div className={`${styles.railStatus} ${resolved ? styles.railStatusDone : ''}`}>
                <span className={styles.railStatusDot} />
                {resolved ? 'Results final' : (isRegistered ? 'Performing tonight' : 'Not entered')}
              </div>
              <MiniLineup />
              <div className={styles.railNote}>
                {resolved
                  ? 'Tune your lineup for tomorrow’s boosts.'
                  : 'Your lineup is locked for tonight’s show. Boosts come from tonight’s programme.'}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ ARCHIVE ══════════ */}
        {tab === 'archive' && archiveView === 'list' && (
          <div className={styles.archiveList}>
            <div className={styles.archiveHint}>Past shows · tap any night to see the full results</div>
            {history == null && <p className={styles.status}>Loading history…</p>}
            {history?.length === 0 && <p className={styles.status}>No resolved shows in your history yet.</p>}
            {history?.map(row => (
              <div key={`${row.showId}`} className={styles.archiveRow} onClick={() => openDetail(row)}>
                <div className={styles.archiveDate}>
                  <div className={styles.archiveDateText}>{row.date}</div>
                  <div className={styles.archiveShowName}>{weekdayShowName(row.date)}</div>
                </div>
                <div className={styles.archiveMid}>
                  <span className={styles.archiveSong}>{row.songTitle}</span>
                </div>
                <div className={styles.archiveRight}>
                  <span className={styles.archiveYou} style={row.rank <= 3 ? { background: 'rgba(245,196,61,.25)', color: '#8a6410' } : {}}>
                    You · #{row.rank}
                  </span>
                  {row.rewardRarity && <span className={styles.archiveReward} style={{ color: RARITY_BORDER[row.rewardRarity] }}>{RARITY_LABEL[row.rewardRarity]}</span>}
                </div>
                <span className={styles.archiveChevron}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'archive' && archiveView === 'detail' && (
          <div className={styles.detailWrap}>
            <div className={styles.detailHead}>
              <button className={styles.backBtn} onClick={() => setArchiveView('list')} title="Back to archive">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M12 4 6 10l6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div>
                <div className={styles.detailDate}>{selected?.date}</div>
                <div className={styles.detailName}>{weekdayShowName(selected?.date)}</div>
              </div>
              {detail && <div className={styles.detailCount}>{detail.leaderboard.length} lineups competed</div>}
            </div>

            {detailLoading && <p className={styles.status}>Loading results…</p>}
            {detail && (
              <>
                {detail.leaderboard.length > 0 && <Podium top3={detail.leaderboard.slice(0, 3)} light />}
                <div className={styles.top10}>
                  <div className={styles.top10Kicker}>FULL RANKING · TOP 10</div>
                  {detail.leaderboard.slice(0, 10).map((r, i) => (
                    <div key={r.rank} className={styles.top10Row} style={i % 2 === 0 ? { background: 'rgba(255,255,255,.4)' } : {}}>
                      <span className={styles.top10Rank} style={{ color: i === 0 ? 'var(--cg-gold-deep)' : i < 3 ? 'var(--cg-rarity-ultra-rare)' : 'var(--cg-ink-3)' }}>{r.rank}</span>
                      <span className={styles.top10Name}>{r.username}</span>
                      <span className={styles.top10Song}>{r.songTitle}</span>
                    </div>
                  ))}
                  {detail.myEntry && !detail.leaderboard.slice(0, 10).some(r => r.isMe) && (
                    <>
                      <div className={styles.top10Divider} />
                      <div className={styles.top10Me}>
                        <span className={styles.top10MeRank}>{detail.myEntry.rank}</span>
                        <span className={styles.top10MeName}>{me?.username}</span>
                        <span className={styles.top10MeTag}>YOU</span>
                        <span className={styles.top10MeSong}>{detail.myEntry.songTitle}</span>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
