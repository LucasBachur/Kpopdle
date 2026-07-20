import { useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getAccessToken, getStoredUsername, logout as apiLogout } from '../services/cardGameApi';
import styles from './Sidebar.module.css';

// Inline SVG icons copied from the design prototype (Sidebar.dc.html → paintIcons()).
const icons = {
  grid: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  music: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M7 15.5V5l9-2v10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5" cy="15.5" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="13.5" r="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  cards: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4.5" width="10" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 4.5l2.5-1.6a2 2 0 0 1 2.7.6l4 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lineup: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 16c.6-2.8 2.9-4.4 5.5-4.4s4.9 1.6 5.5 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  banners: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="4" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="8.5" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 15l4.5-4 3 2.5 2.5-2 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  trophy: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M6 3.5h8v3a4 4 0 0 1-8 0v-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6 4.5H3.5v1A2.5 2.5 0 0 0 6 8M14 4.5h2.5v1A2.5 2.5 0 0 1 14 8M10 10.5v3M7 16.5h6M8 16.5l.5-3M12 16.5l-.5-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const GAMES = [
  { key: 'kpopdle', name: 'Kpopdle', icon: 'grid', to: '/kpopdle', match: (p) => p === '/kpopdle' || p === '/' },
  { key: 'song', name: 'Guess the Song', icon: 'music', to: '/songguess', match: (p) => p === '/songguess' },
];

const CARD_GAME = [
  { key: 'collection', name: 'Collection', icon: 'cards', to: '/card-game/collection', match: (p) => p.startsWith('/card-game/collection') },
  { key: 'lineup', name: 'Lineup', icon: 'lineup', to: '/card-game/lineup', match: (p) => p.startsWith('/card-game/lineup') },
  { key: 'banners', name: 'Banners', icon: 'banners', to: '/card-game/banners', match: (p) => p.startsWith('/card-game/banners') },
  { key: 'shows', name: 'Shows', icon: 'trophy', to: '/card-game/leaderboard', match: (p) => p.startsWith('/card-game/leaderboard') || p.startsWith('/card-game/show-result') },
];

function NavItem({ item, pathname }) {
  const active = item.match(pathname);
  return (
    <Link to={item.to} title={item.name} className={`${styles.navItem} ${active ? styles.active : ''}`}>
      <span className={styles.accentBar} />
      <span className={styles.navIcon}>{icons[item.icon]}</span>
      <span className={styles.navLabel}>{item.name}</span>
    </Link>
  );
}

export default function Sidebar() {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isHoverDevice = useRef(window.matchMedia('(hover: hover) and (pointer: fine)').matches).current;

  // Re-derived on every render; useLocation() re-renders on each navigation,
  // so this stays in sync after login and logout.
  const isAuthed = !!getAccessToken();
  const username = getStoredUsername() || '';

  const open = pinned || hovered;

  function toggle() {
    if (open) {
      setPinned(false);
      setHovered(false);
    } else {
      setPinned(true);
    }
  }

  function handleLogout() {
    apiLogout();
    navigate('/card-game/login');
  }

  return (
    <aside
      className={`${styles.sidebar} ${open ? styles.open : ''}`}
      onMouseEnter={isHoverDevice ? () => setHovered(true) : undefined}
      onMouseLeave={isHoverDevice ? () => setHovered(false) : undefined}
    >
      <div className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandText}>Kpopdle</span>
        </div>
        <button className={styles.chevron} onClick={toggle} title="Toggle sidebar" aria-label="Toggle sidebar">
          <span className={styles.chevronIcon}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </div>

      <div className={styles.sectionLabel}>GAMES</div>
      {GAMES.map((item) => <NavItem key={item.key} item={item} pathname={pathname} />)}

      <div className={`${styles.sectionLabel} ${styles.sectionLabelSpaced}`}>CARD GAME</div>
      {isAuthed ? (
        CARD_GAME.map((item) => <NavItem key={item.key} item={item} pathname={pathname} />)
      ) : (
        <NavItem
          item={{ key: 'signin', name: 'Sign In', icon: 'cards', to: '/card-game/login', match: (p) => p.startsWith('/card-game/login') }}
          pathname={pathname}
        />
      )}

      <div className={styles.spacer} />

      {isAuthed && (
        <>
          <div className={styles.divider} />
          <div className={styles.account}>
            <div className={styles.avatar}>{username.charAt(0).toUpperCase()}</div>
            <div className={styles.accountName}>{username}</div>
          </div>
          <button className={styles.logout} onClick={handleLogout} title="Log out">
            {open ? 'Log out' : '⏻'}
          </button>
        </>
      )}
    </aside>
  );
}
