import { useState, useEffect } from 'react';
import styles from './BannerCard.module.css';

function computeCountdown(endsAt) {
  if (!endsAt) return null;
  const ms = new Date(endsAt) - Date.now();
  if (ms <= 0) return 'Ended';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return `Ends in ${parts.join(' ')}`;
}

export default function BannerCard({ banner, userCurrency, onPull, pulling }) {
  // comeback = SR + UR members; milestone = UR-only members
  const isComeback = banner.members.some(m => m.rarity === 'super_rare');

  // Comeback shows SR cards in the list (UR is hidden — only reachable via rate-up hit).
  // Milestone shows UR cards in the list.
  const displayedMembers = banner.members.filter(m =>
    isComeback ? m.rarity === 'super_rare' : m.rarity === 'ultra_rare'
  );

  // Unique idols from the displayed rarity, ordered by name (already sorted by the AGG).
  const idolOptions = [...new Map(displayedMembers.map(m => [m.idolId, m])).values()];
  const isSoloist = idolOptions.length === 1;

  const [selectedIdolId, setSelectedIdolId] = useState(isSoloist ? idolOptions[0].idolId : null);
  const [countdown, setCountdown] = useState(() => computeCountdown(banner.endsAt));

  useEffect(() => {
    if (!banner.endsAt) return;
    setCountdown(computeCountdown(banner.endsAt));
    const id = setInterval(() => setCountdown(computeCountdown(banner.endsAt)), 60000);
    return () => clearInterval(id);
  }, [banner.endsAt]);

  const freePullsRemaining = banner.freePullsRemaining ?? 0;
  const claimCount = Math.min(freePullsRemaining, 10);
  const canPull = selectedIdolId !== null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.groupName}>{banner.groupName}</span>
        {countdown && <span className={styles.countdown}>{countdown}</span>}
      </div>

      {banner.subtitle && (
        <p className={styles.subtitle}>{banner.subtitle}</p>
      )}

      {banner.description && (
        <p className={styles.description}>{banner.description}</p>
      )}

      <div className={styles.members}>
        {displayedMembers.map(m => (
          <span key={m.cardDefId} className={styles.memberChip}>{m.idolName}</span>
        ))}
      </div>

      {!isSoloist && (
        <div className={styles.rateUp}>
          <span className={styles.rateUpLabel}>Rate Up</span>
          <select
            className={styles.rateUpSelect}
            value={selectedIdolId ?? ''}
            onChange={e => setSelectedIdolId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Choose idol —</option>
            {idolOptions.map(m => (
              <option key={m.idolId} value={m.idolId}>{m.idolName}</option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.actions}>
        {freePullsRemaining > 0 ? (
          <button
            className={`${styles.pullBtn} ${styles.freeBtn}`}
            disabled={pulling || !canPull}
            onClick={() => onPull(banner.id, selectedIdolId, claimCount, true)}
          >
            Claim {claimCount} Free {claimCount === 1 ? 'Pull' : 'Pulls'}
            {freePullsRemaining > 10 && (
              <span className={styles.cost}> ({freePullsRemaining - claimCount} remaining)</span>
            )}
          </button>
        ) : (
          <>
            <button
              className={styles.pullBtn}
              disabled={pulling || !canPull || userCurrency < 9}
              onClick={() => onPull(banner.id, selectedIdolId, 10, false)}
            >
              Pull ×10 <span className={styles.cost}>(9 💎)</span>
            </button>
            <button
              className={styles.pullBtn}
              disabled={pulling || !canPull || userCurrency < 1}
              onClick={() => onPull(banner.id, selectedIdolId, 1, false)}
            >
              Pull ×1 <span className={styles.cost}>(1 💎)</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
