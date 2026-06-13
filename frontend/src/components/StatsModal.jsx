function StatsModal({ stats, onClose }) {
  const maxValue = Math.max(1, ...Object.values(stats.guessDistribution));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>

        <h2>Stats</h2>
        <p>Total plays: {stats.gamesPlayed}</p>
        <p>Current Streak: {stats.currentStreak}</p>
        <p>Max Streak: {stats.maxStreak}</p>

        <h3>Number of tries distribution:</h3>
        <div className="distribution-container">
          {Object.entries(stats.guessDistribution).map(([attempts, count]) => {
            const pct = (count / maxValue) * 100;
            return (
              <div key={attempts} className="bar-wrapper">
                {count > 0 && <span className="bar-count">{count}</span>}
                <div className="bar" style={{ height: `${pct}%` }} title={`${count} times`} />
                <span className="bar-label">{attempts}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default StatsModal;
