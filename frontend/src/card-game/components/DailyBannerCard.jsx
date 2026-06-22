import { useState, useEffect } from 'react';
import styles from './DailyBannerCard.module.css';

function getNextReset() {
  // Midnight ART (UTC-3, no DST) = 03:00 UTC
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

export default function DailyBannerCard({ banner, isAvailable, onClaim, claiming }) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (isAvailable) { setCountdown(''); return; }
    function tick() {
      setCountdown(formatCountdown(getNextReset() - Date.now()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isAvailable]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.name}>{banner.groupName}</span>
        <span className={styles.permanent}>Permanent</span>
      </div>

      <div className={styles.actions}>
        {isAvailable ? (
          <button
            className={styles.claimBtn}
            disabled={claiming}
            onClick={onClaim}
          >
            {claiming ? 'Pulling…' : 'Claim Daily Pull'}
          </button>
        ) : (
          <div className={styles.exhausted}>
            <span className={styles.exhaustedLabel}>Come back tomorrow</span>
            <span className={styles.countdown}>{countdown}</span>
          </div>
        )}
      </div>
    </div>
  );
}
