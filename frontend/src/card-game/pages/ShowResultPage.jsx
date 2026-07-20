import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLeaderboard } from '../services/cardGameApi';
import LeaderboardTable from '../components/LeaderboardTable';
import styles from './ShowResultPage.module.css';

const RARITY_LABEL = {
  ultra_rare: 'Ultra Rare',
  super_rare: 'Super Rare',
  rare: 'Rare',
};

const RARITY_COLOR = {
  ultra_rare: 'var(--cg-rarity-ultra-rare)',
  super_rare: 'var(--cg-rarity-super-rare)',
  rare: 'var(--cg-rarity-rare)',
};

const weekdayShowName = (date) =>
  date ? `${new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })} Show` : 'Show';

export default function ShowResultPage() {
  const { showId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!showId) return;
    setLoading(true);
    getLeaderboard(showId)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [showId]);

  if (loading) return <div className={styles.page}><p className={styles.status}>Loading results...</p></div>;
  if (error) return <div className={styles.page}><p className={styles.error}>{error}</p></div>;
  if (!data) return null;

  const { show, myEntry, leaderboard, autoEntryStatus } = data;
  const isPending = show.resolutionStatus === 'pending';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to="/card-game/leaderboard" className={styles.back}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M12 4 6 10l6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Shows
        </Link>
        <h1 className={styles.title}>{weekdayShowName(show.date)}<span className={styles.titleDate}> · {show.date}</span></h1>
        <span className={`${styles.badge} ${isPending ? styles.pendingBadge : styles.resolvedBadge}`}>
          {isPending ? 'In Progress' : 'Final'}
        </span>
      </div>

      {autoEntryStatus?.isRegistered && (
        <div className={styles.autoEntryCard}>
          <span className={styles.autoDot} />
          Your lineup is registered for this show
        </div>
      )}

      {myEntry && !isPending && (
        <div className={styles.myCard}>
          <div className={styles.myRank}>#{myEntry.rank}</div>
          <div className={styles.myDetails}>
            <p className={styles.myLabel}>YOUR RESULT</p>
            <p className={styles.myScore}>{myEntry.score?.toLocaleString()} pts</p>
            {myEntry.rewardRarity && (
              <p className={styles.myReward} style={{ color: RARITY_COLOR[myEntry.rewardRarity] }}>
                Reward: {RARITY_LABEL[myEntry.rewardRarity]} pull earned
              </p>
            )}
          </div>
        </div>
      )}

      {isPending && (
        <div className={styles.pendingNotice}>
          The show is still in progress. Final results will appear after the deadline.
        </div>
      )}

      <div className={styles.tablePanel}>
        <LeaderboardTable entries={leaderboard} pending={isPending} />
      </div>
    </div>
  );
}
