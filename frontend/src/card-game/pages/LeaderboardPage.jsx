import { useState, useEffect } from 'react';
import { getTodayShows, getLeaderboard, getLeaderboardHistory } from '../services/cardGameApi';
import LeaderboardTable from '../components/LeaderboardTable';
import styles from './LeaderboardPage.module.css';

export default function LeaderboardPage() {
  const [todayShows, setTodayShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState('today'); // 'today' | 'history'
  const [loading, setLoading] = useState(true);
  const [lbLoading, setLbLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTodayShows()
      .then(data => {
        setTodayShows(data.shows || []);
        if (data.shows?.length) setSelectedShow(data.shows[0]);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedShow) return;
    setLbLoading(true);
    setLeaderboardData(null);
    getLeaderboard(selectedShow.id)
      .then(setLeaderboardData)
      .catch(err => setError(err.message))
      .finally(() => setLbLoading(false));
  }, [selectedShow]);

  useEffect(() => {
    if (view !== 'history') return;
    getLeaderboardHistory('gg', 30, 0)
      .then(data => setHistory(data.history || []))
      .catch(err => setError(err.message));
  }, [view]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Leaderboard</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${view === 'today' ? styles.active : ''}`}
          onClick={() => setView('today')}
        >
          Today's Show
        </button>
        <button
          className={`${styles.tab} ${view === 'history' ? styles.active : ''}`}
          onClick={() => setView('history')}
        >
          My History
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {view === 'today' && (
        <>
          {loading && <p className={styles.status}>Loading...</p>}

          {!loading && todayShows.length > 1 && (
            <div className={styles.showPicker}>
              {todayShows.map(show => (
                <button
                  key={show.id}
                  className={`${styles.showBtn} ${selectedShow?.id === show.id ? styles.showActive : ''}`}
                  onClick={() => setSelectedShow(show)}
                >
                  {show.genderCategory === 'gg' ? 'GG Show' : 'BG Show'}
                </button>
              ))}
            </div>
          )}

          {selectedShow && (
            <div className={styles.showMeta}>
              <span>Show date: <strong>{selectedShow.date}</strong></span>
              <span className={`${styles.statusBadge} ${selectedShow.resolutionStatus === 'resolved' ? styles.resolved : styles.pending}`}>
                {selectedShow.resolutionStatus}
              </span>
            </div>
          )}

          {lbLoading && <p className={styles.status}>Loading results...</p>}

          {!lbLoading && leaderboardData && (
            <>
              {leaderboardData.myEntry && (
                <div className={styles.myResult}>
                  Your result: Rank <strong>#{leaderboardData.myEntry.rank}</strong> · Score <strong>{leaderboardData.myEntry.score?.toLocaleString()}</strong>
                </div>
              )}
              <LeaderboardTable
                entries={leaderboardData.leaderboard}
                pending={selectedShow?.resolutionStatus === 'pending'}
              />
            </>
          )}
        </>
      )}

      {view === 'history' && (
        <div className={styles.historyList}>
          {history.length === 0 && <p className={styles.status}>No show history yet.</p>}
          {history.map((row, i) => (
            <div key={i} className={styles.historyRow}>
              <span className={styles.histDate}>{row.date}</span>
              <span className={styles.histSong}>{row.songTitle}</span>
              <span className={styles.histRank}>#{row.rank}</span>
              <span className={styles.histScore}>{row.score?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
