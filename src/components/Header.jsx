import './Header.css';

function Header() {
  return (
    <header className="header">
        <div className="header-container">
            <div className="logoa">Kpopdle</div>
            <div className="header-buttons">
                <button>Mode 1</button>
                <button>Mode 2</button>
                <button>Mode 3</button>
            </div>
        </div>
    </header>
  );
}

export default Header;
