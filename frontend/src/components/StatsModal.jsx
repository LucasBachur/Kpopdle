import { useState, useEffect } from 'react';
import styles from './StatsModal.module.css';

// Next daily reset = midnight ART (UTC-3, no DST) = 03:00 UTC.
function getNextReset() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
function fmtHMS(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function StatsModal({ stats, onClose, nextLabel = 'NEXT PUZZLE' }) {
  const [countdown, setCountdown] = useState(() => fmtHMS(getNextReset() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setCountdown(fmtHMS(getNextReset() - Date.now())), 1000);
    return () => clearInterval(id);
  }, []);

  const dist = Object.entries(stats.guessDistribution);
  const maxCount = Math.max(1, ...dist.map(([, c]) => c));

  // Average guesses to solve. Exact from totalGuesses; for saves predating that
  // field, estimate from the distribution (the "5+" bucket counts as 5).
  const totalGuesses = stats.totalGuesses
    ?? dist.reduce((sum, [k, c]) => sum + (k === '5+' ? 5 : Number(k)) * c, 0);
  const avg = stats.gamesPlayed > 0 ? (totalGuesses / stats.gamesPlayed).toFixed(1) : '—';

  const tiles = [
    { value: stats.gamesPlayed, label: 'PLAYED', gold: false },
    { value: avg, label: 'AVG GUESSES', gold: false },
    { value: stats.currentStreak, label: 'CURRENT', gold: true },
    { value: stats.maxStreak, label: 'MAX STREAK', gold: true },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.topBar} />
        <div className={styles.body}>
          <div className={styles.head}>
            <div>
              <div className={styles.kicker}>YOUR RECORD</div>
              <div className={styles.heading}>Statistics</div>
            </div>
            <button className={styles.close} onClick={onClose} title="Close">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className={styles.tiles}>
            {tiles.map(t => (
              <div key={t.label} className={styles.tile}>
                <div className={styles.tileValue} style={t.gold ? { color: 'var(--cg-gold)' } : { color: '#fff' }}>{t.value}</div>
                <div className={styles.tileLabel}>{t.label}</div>
              </div>
            ))}
          </div>

          <div className={styles.distKicker}>GUESS DISTRIBUTION</div>
          <div className={styles.dist}>
            {dist.map(([k, c]) => (
              <div key={k} className={styles.distRow}>
                <span className={styles.distKey}>{k}</span>
                <div className={styles.distTrack}>
                  <div className={styles.distBar} style={{ width: `${Math.max(11, (c / maxCount) * 100)}%` }}>
                    <span className={styles.distCount}>{c}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.footer}>
            <div>
              <div className={styles.nextKicker}>{nextLabel}</div>
              <div className={styles.nextTime}>{countdown}</div>
            </div>
            <button className={styles.keepBtn} onClick={onClose}>Keep playing</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatsModal;
