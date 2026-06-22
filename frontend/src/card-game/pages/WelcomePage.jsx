import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMe, completeOnboarding } from '../services/cardGameApi';
import styles from './WelcomePage.module.css';

const RARITY_COLOR = { rare: '#60a5fa', super_rare: '#a78bfa', ultra_rare: '#fbbf24' };
const RARITY_LABEL = { rare: 'Rare', super_rare: 'Super Rare', ultra_rare: 'Ultra Rare' };

function Badge({ card }) {
  if (card.isNew)      return <span className={`${styles.badge} ${styles.badgeNew}`}>New!</span>;
  if (card.wasUpgrade) return <span className={`${styles.badge} ${styles.badgeUpgrade}`}>+1 stat</span>;
  return                      <span className={`${styles.badge} ${styles.badgeOverflow}`}>Overflow</span>;
}

export default function WelcomePage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const cards = state?.starterCards ?? null;

  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    getMe()
      .then(me => {
        if (me.onboardingCompleted) {
          navigate('/card-game/collection', { replace: true });
        } else if (!cards?.length) {
          // No cards in state (direct navigation) — skip to collection
          navigate('/card-game/collection', { replace: true });
        } else {
          setReady(true);
        }
      })
      .catch(() => navigate('/card-game/login', { replace: true }));
  }, []);

  async function handleContinue() {
    setCompleting(true);
    try {
      await completeOnboarding();
    } finally {
      navigate('/card-game/collection', { replace: true });
    }
  }

  function advance() {
    if (index < cards.length - 1) {
      setIndex(i => i + 1);
    } else {
      setShowSummary(true);
    }
  }

  if (!ready) return null;

  if (showSummary) {
    return (
      <div className={styles.page}>
        <h1 className={styles.headline}>Your Starter Collection</h1>
        <p className={styles.sub}>You received {cards.length} cards to kick things off.</p>
        <div className={styles.summaryGrid}>
          {cards.map((card, i) => (
            <div
              key={i}
              className={styles.summaryCard}
              style={{ borderTopColor: RARITY_COLOR[card.rarity] }}
            >
              <span className={styles.summaryRarity} style={{ color: RARITY_COLOR[card.rarity] }}>
                {RARITY_LABEL[card.rarity]}
              </span>
              <span className={styles.summaryName}>{card.idolName}</span>
              <span className={styles.summaryGroup}>{card.group}</span>
            </div>
          ))}
        </div>
        <button
          className={styles.continueBtn}
          disabled={completing}
          onClick={handleContinue}
        >
          {completing ? 'Loading…' : 'Continue to My Collection →'}
        </button>
      </div>
    );
  }

  const card = cards[index];
  const color = RARITY_COLOR[card.rarity];

  return (
    <div className={styles.revealPage} onClick={advance}>
      <p className={styles.welcomeLabel}>Welcome to Kpopdle Cards!</p>
      <p className={styles.progress}>{index + 1} / {cards.length}</p>

      <div key={index} className={styles.revealCard} style={{ borderTopColor: color }}>
        <span className={styles.revealRarity} style={{ color }}>{RARITY_LABEL[card.rarity]}</span>
        <span className={styles.revealName}>{card.idolName}</span>
        <span className={styles.revealGroup}>{card.group}</span>
        <Badge card={card} />
      </div>

      <button
        className={styles.nextBtn}
        onClick={e => { e.stopPropagation(); advance(); }}
      >
        {index < cards.length - 1 ? 'Next Card →' : 'See Summary →'}
      </button>
      <p className={styles.clickHint}>Click anywhere to continue</p>
    </div>
  );
}
