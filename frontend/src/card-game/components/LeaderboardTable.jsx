import styles from './LeaderboardTable.module.css';

const RARITY_LABEL = { ultra_rare: 'UR', super_rare: 'SR', rare: 'R' };
const RARITY_COLOR = {
  ultra_rare: 'var(--cg-rarity-ultra-rare)',
  super_rare: 'var(--cg-rarity-super-rare)',
  rare: 'var(--cg-rarity-rare)',
};

export default function LeaderboardTable({ entries, pending }) {
  if (pending) {
    return <p className={styles.status}>Show is still in progress. Results will appear after the deadline.</p>;
  }
  if (!entries || entries.length === 0) {
    return <p className={styles.status}>No entries for this show.</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.th}>#</th>
          <th className={styles.th}>Player</th>
          <th className={styles.th}>Song</th>
          <th className={styles.th}>Score</th>
          <th className={styles.th}>Reward</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => (
          <tr key={i} className={`${styles.row} ${entry.isMe ? styles.myRow : ''}`}>
            <td className={styles.td}>{entry.rank ?? '—'}</td>
            <td className={styles.td}>
              <span className={entry.isMe ? styles.meLabel : ''}>{entry.username}</span>
              {entry.isMe && <span className={styles.youBadge}>You</span>}
            </td>
            <td className={styles.td}>{entry.songTitle}</td>
            <td className={`${styles.td} ${styles.score}`}>{entry.score?.toLocaleString()}</td>
            <td className={styles.td}>
              {entry.rewardRarity && (
                <span className={styles.reward} style={{ color: RARITY_COLOR[entry.rewardRarity] }}>
                  {RARITY_LABEL[entry.rewardRarity]}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
