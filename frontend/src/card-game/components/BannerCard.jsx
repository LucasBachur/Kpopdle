import { useState } from 'react';
import styles from './BannerCard.module.css';

function endsInLabel(endsAt) {
  if (!endsAt) return 'Permanent';
  const ms = new Date(endsAt) - Date.now();
  if (ms <= 0) return 'Ended';
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return `Ends in ${hours}h`;
  return `Ends in ${Math.ceil(hours / 24)}d`;
}

export default function BannerCard({ banner, userCurrency, freePulls, onPull, pulling }) {
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

  const claimCount = Math.min(freePulls, 10);
  const canPull = selectedIdolId !== null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.groupName}>{banner.groupName}</span>
        <span className={styles.endsAt}>{endsInLabel(banner.endsAt)}</span>
      </div>

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
        {freePulls > 0 ? (
          <button
            className={`${styles.pullBtn} ${styles.freeBtn}`}
            disabled={pulling || !canPull}
            onClick={() => onPull(banner.id, selectedIdolId, claimCount, true)}
          >
            Claim {claimCount} Free {claimCount === 1 ? 'Pull' : 'Pulls'}
            {freePulls > 10 && (
              <span className={styles.cost}> ({freePulls - claimCount} remaining)</span>
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
