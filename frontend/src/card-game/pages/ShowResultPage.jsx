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
  ultra_rare: '#f59e0b',
  super_rare: '#a855f7',
  rare: '#888',
};

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
        <Link to="/card-game/leaderboard" className={styles.back}>← Leaderboard</Link>
        <h1 className={styles.title}>Show Results — {show.date}</h1>
        <span className={`${styles.badge} ${isPending ? styles.pendingBadge : styles.resolvedBadge}`}>
          {isPending ? 'In Progress' : 'Final'}
        </span>
      </div>

      {autoEntryStatus?.isRegistered && (
        <div className={styles.autoEntryCard}>
          Your lineup is registered for today's show
        </div>
      )}

      {myEntry && !isPending && (
        <div className={styles.myCard}>
          <div className={styles.myRank}>#{myEntry.rank}</div>
          <div className={styles.myDetails}>
            <p className={styles.myLabel}>Your Result</p>
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

      <LeaderboardTable entries={leaderboard} pending={isPending} />
    </div>
  );
}
