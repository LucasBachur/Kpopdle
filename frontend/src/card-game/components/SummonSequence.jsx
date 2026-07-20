import { useState, useRef, useEffect } from 'react';
import styles from './SummonSequence.module.css';
import CardPhoto from './CardPhoto';

const RARITY = {
  rare:       { label: 'R',  border: 'var(--cg-rarity-rare)',       text: '#2a2138',
                glow: 'rgba(179,182,196,.5)',  hoverBlur: '18px', raysInset: '-26%', raysBlur: '15px' },
  super_rare: { label: 'SR', border: 'var(--cg-rarity-super-rare)', text: '#3a2600',
                glow: 'rgba(245,196,61,.5)',   hoverBlur: '13px', raysInset: '-16%', raysBlur: '11px' },
  ultra_rare: { label: 'UR', border: 'var(--cg-rarity-ultra-rare)', text: '#fff',
                glow: 'rgba(155,93,229,.95)',  hoverBlur: '36px', raysInset: '-48%', raysBlur: '22px' },
};

// When the intro (album/disc/pack) hands off to the pack-opening card emergence.
const INTRO_MS = 6650;

// Zigzag crimp for the foil pack edges (count=9, w=120, h=8 — matches the design).
function zigzagPath(count, w, h) {
  const step = w / count;
  let d = 'M0,0';
  for (let i = 0; i < count; i++) {
    d += ` L${(i * step + step / 2).toFixed(2)},${h} L${((i + 1) * step).toFixed(2)},0`;
  }
  return d + ' Z';
}
function zigzagPoints(count, w, h) {
  const step = w / count;
  const pts = ['0,0'];
  for (let i = 0; i < count; i++) {
    pts.push(`${(i * step + step / 2).toFixed(2)},${h}`, `${((i + 1) * step).toFixed(2)},0`);
  }
  return pts.join(' ');
}
const ZZ_D = zigzagPath(9, 120, 8);
const ZZ_P = zigzagPoints(9, 120, 8);

export default function SummonSequence({ cards, cinematic = false, group, comeback, onClose }) {
  const [stage, setStage] = useState(cinematic ? 'intro' : 'grid'); // intro | cardsOut | grid
  const [flipped, setFlipped] = useState(() => cards.map(() => false));
  const [urFlash, setUrFlash] = useState(false);
  const timers = useRef([]);
  const packRef = useRef(null);
  const gridRef = useRef(null);

  // intro → cardsOut
  useEffect(() => {
    if (stage === 'intro') {
      timers.current.push(setTimeout(() => setStage('cardsOut'), INTRO_MS));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pack opens and drops; cards fly out of it one by one; pack falls away; → grid.
  useEffect(() => {
    if (stage !== 'cardsOut') return;
    const pack = packRef.current;
    const partialDropMs = 300;
    if (pack) {
      pack.animate([
        { transform: 'translate(-50%,-50%) translate(0,-10px) scale(1)' },
        { transform: 'translate(-50%,-50%) translate(0,220px) scale(1)' },
      ], { duration: partialDropMs, easing: 'ease', fill: 'forwards' });
    }
    const cardDuration = 333, cardStagger = 333, cardCount = cards.length;
    timers.current.push(setTimeout(() => emergeCards(cardDuration, cardStagger), partialDropMs));

    const cardsDoneMs = partialDropMs + (cardCount - 1) * cardStagger + cardDuration;
    timers.current.push(setTimeout(() => {
      if (pack) {
        pack.animate([
          { transform: 'translate(-50%,-50%) translate(0,220px) scale(1)', opacity: 1 },
          { transform: 'translate(-50%,-50%) translate(0,480px) scale(.9)', opacity: 0 },
        ], { duration: 367, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      }
      timers.current.push(setTimeout(() => setStage('grid'), 367));
    }, cardsDoneMs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Fly each grid card from the pack's center out to its resting slot (staggered arc).
  function emergeCards(duration, stagger) {
    const grid = gridRef.current;
    const pack = packRef.current;
    if (!grid) return;
    const els = [...grid.children];
    const packRect = pack ? pack.getBoundingClientRect() : null;
    const packCx = packRect ? packRect.left + packRect.width / 2 : null;
    const packCy = packRect ? packRect.top + packRect.height / 2 : null;
    els.forEach((el, i) => {
      let dx, dy;
      if (packCx != null) {
        const r = el.getBoundingClientRect();
        dx = packCx - (r.left + r.width / 2);
        dy = packCy - (r.top + r.height / 2);
      } else {
        dx = 0; dy = 70;
      }
      const delay = i * stagger;
      const spin = (i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 4);
      const arcLift = -34 - (i % 3) * 10;
      el.animate([
        { transform: `translate(${dx}px,${dy}px) scale(.3) rotate(${spin}deg)`, opacity: 0, offset: 0 },
        { transform: `translate(${dx}px,${dy}px) scale(.34) rotate(${spin}deg)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${dx * 0.45}px,${dy * 0.45 + arcLift}px) scale(.7) rotate(${spin * 0.4}deg)`, opacity: 1, offset: 0.55 },
        { transform: 'translate(0px,-8px) scale(1.08) rotate(0deg)', opacity: 1, offset: 0.82 },
        { transform: 'translate(0px,0px) scale(1) rotate(0deg)', opacity: 1, offset: 1 },
      ], { duration, delay, easing: 'cubic-bezier(.25,.6,.3,1)', fill: 'both' });
    });
  }

  const allFlipped = flipped.every(Boolean);

  function flip(i) {
    setFlipped(prev => {
      if (prev[i]) return prev;
      const next = [...prev];
      next[i] = true;
      return next;
    });
    if (cards[i].rarity === 'ultra_rare') {
      setUrFlash(true);
      timers.current.push(setTimeout(() => setUrFlash(false), 500));
    }
  }

  function flipAll() {
    cards.forEach((_, i) => timers.current.push(setTimeout(() => flip(i), i * 70)));
  }

  function skipIntro() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (packRef.current) packRef.current.getAnimations().forEach(a => a.cancel());
    setStage('grid');
  }

  const cols = Math.min(cards.length, 5);
  const showIntro = stage === 'intro' || stage === 'cardsOut';
  const showGrid = stage === 'cardsOut' || stage === 'grid';

  return (
    <div className={styles.overlay}>
      <div className={styles.urFlash} style={{ opacity: urFlash ? 1 : 0 }} />

      {showIntro && (
        <div className={styles.stage}>
          {stage === 'intro' && <button className={styles.skip} onClick={skipIntro}>Skip ›</button>}

          {/* album cover */}
          <div className={styles.album}>
            <div className={styles.albumStripes} />
            {group && <div className={styles.albumGroup}>{group}</div>}
            {comeback && <div className={styles.albumTitle}>{comeback}</div>}
          </div>

          {/* vinyl disc + tonearm */}
          <div className={styles.discBase}><div className={styles.discHole} /></div>
          <div className={styles.tonearm}>
            <div className={styles.tonearmShaft} />
            <div className={styles.tonearmPivot} />
            <div className={styles.tonearmHead} />
          </div>
          <div className={styles.disc}><div className={styles.discInner} /></div>

          {/* foil card pack */}
          <div className={styles.pack} ref={packRef}>
            <div className={styles.packBody}><div className={styles.packShine} /></div>
            <svg className={styles.packCrimpBottom} viewBox="0 0 120 8" preserveAspectRatio="none">
              <path d={ZZ_D} fill="#b7bbc4" />
              <polyline points={ZZ_P} fill="none" stroke="#fff" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <div className={styles.packFlap}>
              <div className={styles.packFlapInner}><div className={styles.packShine} /></div>
              <svg className={styles.packCrimpTop} viewBox="0 0 120 8" preserveAspectRatio="none">
                <path d={ZZ_D} fill="#c7cad0" />
                <polyline points={ZZ_P} fill="none" stroke="#fff" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
            <div className={styles.packCut} />
          </div>
        </div>
      )}

      {showGrid && (
        <div className={styles.content} style={stage === 'cardsOut' ? { overflow: 'visible' } : undefined}>
          <div className={styles.grid} ref={gridRef} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {cards.map((card, i) => {
              const r = RARITY[card.rarity] ?? RARITY.rare;
              const isFlipped = flipped[i];
              return (
                <div
                  key={i}
                  className={`${styles.cardWrap} ${cinematic ? '' : styles.pop}`}
                  style={{
                    opacity: stage === 'cardsOut' ? 0 : 1,
                    '--gborder': r.border,
                    '--gsoft': r.glow,
                    '--ghover': r.hoverBlur,
                    '--rays-inset': r.raysInset,
                    '--rays-blur': r.raysBlur,
                  }}
                >
                  {isFlipped && (
                    <div
                      className={`${styles.rays} ${card.rarity === 'ultra_rare' ? styles.pulse : ''}`}
                      style={{ background: `radial-gradient(circle, ${r.glow} 0%, transparent 70%)` }}
                    />
                  )}
                  <div className={styles.card} onClick={() => stage === 'grid' && flip(i)}>
                    <div className={`${styles.flipInner} ${isFlipped ? styles.isFlipped : ''}`}>
                      <div className={styles.faceBack}>
                        <span className={styles.spark}>✦</span>
                      </div>
                      <div className={styles.faceFront} style={{ borderColor: r.border }}>
                        <CardPhoto artPath={card.artPath} />
                        <div className={styles.rarityBadge} style={{ background: r.border, color: r.text }}>{r.label}</div>
                        <div className={styles.nameScrim}>{card.idolName}</div>
                        {card.isNew && <div className={styles.tag}>New</div>}
                        {!card.isNew && card.wasUpgrade && <div className={styles.tag}>+1</div>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Always rendered so the reveal's height (and vertical centering) doesn't
              shift between cardsOut and grid — just hidden until interactive. */}
          <div
            className={styles.actions}
            style={stage === 'cardsOut' ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
          >
            {cards.length > 1 && !allFlipped && (
              <button className={styles.flipAllBtn} onClick={flipAll}>Flip All</button>
            )}
            <button
              className={`${styles.continueBtn} ${allFlipped ? '' : styles.continueDisabled}`}
              onClick={() => allFlipped && onClose()}
              disabled={!allFlipped}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
