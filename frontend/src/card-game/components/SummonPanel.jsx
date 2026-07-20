import styles from './SummonPanel.module.css';
import BannerKeyArt from './BannerKeyArt';
import CardPhoto from './CardPhoto';

const MEMBER_RARITY = {
  super_rare: { label: 'SR', border: 'var(--cg-rarity-super-rare)', text: '#3a2600' },
  ultra_rare: { label: 'UR', border: 'var(--cg-rarity-ultra-rare)', text: '#fff' },
};

export default function SummonPanel({ vm, selectedIdolId, onSelect, onPull, onRates, currency, pity, pulling }) {
  const pityCount = pity?.count ?? 0;
  const pityThreshold = pity?.threshold ?? 100;
  const pityPct = Math.min(100, Math.round((pityCount / pityThreshold) * 100));
  const canPull = vm.requiresSelect ? selectedIdolId != null : true;
  const freePulls = vm.freePullsRemaining;
  const freeClaim = Math.min(freePulls, 10);

  function toggle(idolId) {
    onSelect(selectedIdolId === idolId ? null : idolId);
  }

  return (
    <div className={styles.panel}>
      {/* hero key art (placeholder) */}
      <div className={styles.hero} style={{ background: `linear-gradient(135deg, ${vm.accentA}, ${vm.accentB})` }}>
        <BannerKeyArt src={vm.keyArt} variant="hero" />
        <div className={styles.heroScrim} />
        <span
          className={styles.typeBadge}
          style={{
            background: vm.isComeback ? 'rgba(155,93,229,.9)' : 'rgba(234,163,28,.92)',
            color: vm.isComeback ? '#fff' : '#3a2600',
          }}
        >
          {vm.typeLabel}
        </span>
        <button className={styles.ratesBtn} onClick={onRates} title="Drop rates">%</button>
        <div className={styles.heroFooter}>
          <div className={styles.heroGroup}>{vm.group}</div>
          <div className={styles.heroTitleRow}>
            <div className={styles.heroTitle}>{vm.comeback}</div>
            {vm.endsIn && <div className={styles.heroEnds}>{vm.endsIn}</div>}
          </div>
          {vm.subtitle && <div className={styles.heroSubtitle}>{vm.subtitle}</div>}
        </div>
      </div>

      {/* rate-up note */}
      <div className={styles.rateUpHead}>
        <span className={styles.kicker}>RATE-UP</span>
        <span className={styles.rateNote}>
          {vm.isComeback
            ? 'Members are SR — pick one to boost odds and unlock their UR version.'
            : 'Members are UR — pick one to boost your odds for that idol.'}
        </span>
      </div>
      <div className={styles.hint}>{!canPull ? 'Select a rate-up idol to summon on this banner.' : ''}</div>

      {/* member rate-up row */}
      <div className={styles.memberRow}>
        {vm.members.map(m => {
          const r = MEMBER_RARITY[m.rarity] ?? MEMBER_RARITY.super_rare;
          const isSel = selectedIdolId === m.idolId;
          return (
            <button
              key={m.idolId}
              className={`${styles.member} ${isSel ? styles.memberSel : ''}`}
              style={{ borderColor: r.border }}
              onClick={() => toggle(m.idolId)}
            >
              <CardPhoto artPath={m.artPath} />
              <div className={styles.memberBadge} style={{ background: r.border, color: r.text }}>{r.label}</div>
              <div className={styles.memberName}>{m.name}</div>
            </button>
          );
        })}
      </div>

      {/* pity — real counter (shared across banners); guaranteed UR at the threshold */}
      <div className={styles.pity}>
        <div className={styles.pityHead}>
          <span className={styles.kicker}>PITY · GUARANTEED UR</span>
          <span className={styles.pityText}>{pityCount} / {pityThreshold}</span>
        </div>
        <div className={styles.pityTrack}>
          <div className={styles.pityFill} style={{ width: `${pityPct}%` }} />
        </div>
      </div>

      {/* pull actions */}
      {freePulls > 0 ? (
        <div className={styles.actionsSingle}>
          <button
            className={styles.freeBtn}
            disabled={pulling || !canPull}
            onClick={() => onPull(freeClaim, true)}
          >
            Claim {freeClaim} Free {freeClaim === 1 ? 'Pull' : 'Pulls'}
            {freePulls > 10 && <span className={styles.freeNote}> · {freePulls - freeClaim} left</span>}
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            className={styles.pull10}
            disabled={pulling || !canPull || currency < 9}
            onClick={() => onPull(10, false)}
          >
            Summon ×10 <span className={styles.cost}>9<span className={styles.lightGold}>◈</span></span>
          </button>
          <button
            className={styles.pull1}
            disabled={pulling || !canPull || currency < 1}
            onClick={() => onPull(1, false)}
          >
            Summon ×1 <span className={styles.cost}>1<span className={styles.lightBlue}>◈</span></span>
          </button>
        </div>
      )}
    </div>
  );
}
