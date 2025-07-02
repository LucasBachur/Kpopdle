import './LoadingScreen.css';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p className="main-message">Warming up the stage... 🎤✨</p>
      <p className="sub-message">
        If the server is asleep, this might take up to a minute to load.<br />
        Thanks for your patience 💖
      </p>
    </div>
  );
}

export default LoadingScreen;