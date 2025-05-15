import './Header.css';

function Header() {
  return (
    <header className="header">
        <div className="header-container">
            <div className="logoa">Kpopdle</div>
            <div className="header-buttons">
                <button>All</button>
                <button>GG</button>
                <button>BG</button>
            </div>
        </div>
    </header>
  );
}

export default Header;
