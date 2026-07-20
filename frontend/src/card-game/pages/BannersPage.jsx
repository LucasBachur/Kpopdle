import { useState, useEffect, useMemo, useCallback } from 'react';
import { getMe, getBanners, pullBanner, claimDailyPull, getPity } from '../services/cardGameApi';
import SummonPanel from '../components/SummonPanel';
import SummonSequence from '../components/SummonSequence';
import BannerKeyArt from '../components/BannerKeyArt';
import styles from './BannersPage.module.css';

const ACCENTS = [
  ['#7b4bd6', '#3a2a5c'], ['#4f9bd8', '#26405e'], ['#d15c8a', '#5a2440'],
  ['#d1485a', '#5a2028'], ['#b84bc4', '#4a1c52'], ['#e0863a', '#5e3418'],
  ['#e6b23a', '#7a5410'], ['#3aa0a0', '#184a4a'],
];
function accentFor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

function computeEndsIn(endsAt) {
  if (!endsAt) return null;
  const ms = new Date(endsAt) - Date.now();
  if (ms <= 0) return 'Ended';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (d === 0 && h === 0) parts.push(`${m}m`);
  return `Ends in ${parts.join(' ')}`;
}

// Midnight ART (UTC-3, no DST) = 03:00 UTC
function getNextReset() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
function formatHMS(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function bannerVM(banner) {
  const isComeback = banner.members.some(m => m.rarity === 'super_rare');
  const memberRarity = isComeback ? 'super_rare' : 'ultra_rare';
  const display = banner.members.filter(m => m.rarity === memberRarity);
  const idolOptions = [...new Map(display.map(m => [m.idolId, m])).values()];
  const [accentA, accentB] = accentFor(banner.groupName);
  return {
    id: banner.id,
    group: banner.groupName,
    comeback: banner.description,
    subtitle: banner.subtitle,
    keyArt: `/banner-art/${banner.id}.webp`,
    isComeback,
    typeLabel: isComeback ? 'Comeback' : 'Special',
    endsIn: computeEndsIn(banner.endsAt),
    accentA, accentB,
    members: idolOptions.map(m => ({ idolId: m.idolId, name: m.idolName, rarity: memberRarity, artPath: m.artPath })),
    requiresSelect: isComeback,
    isSoloist: idolOptions.length === 1,
    freePullsRemaining: banner.freePullsRemaining ?? 0,
  };
}

const RATE_DOT = {
  R: 'var(--cg-rarity-rare)', SR: 'var(--cg-rarity-super-rare)', UR: 'var(--cg-rarity-ultra-rare)',
};
function ratesFor(target, vm) {
  // Percentages are placeholder pending final tuning (per design handoff).
  if (target === 'daily') {
    return {
      title: 'Daily Summon',
      rows: [
        { label: 'UR', pct: '0.5%', dot: RATE_DOT.UR },
        { label: 'SR', pct: '9.5%', dot: RATE_DOT.SR },
        { label: 'R — standard', pct: '90.0%', dot: RATE_DOT.R },
      ],
    };
  }
  if (!vm) return null;
  return {
    title: `${vm.group} · ${vm.comeback}`,
    rows: vm.isComeback
      ? [
          { label: 'UR — rate-up idol', pct: '2.0%', dot: RATE_DOT.UR },
          { label: 'SR — featured members', pct: '18.0%', dot: RATE_DOT.SR },
          { label: 'R — standard', pct: '80.0%', dot: RATE_DOT.R },
        ]
      : [
          { label: 'UR — rate-up idol', pct: '1.2%', dot: RATE_DOT.SR },
          { label: 'UR — other members', pct: '2.8%', dot: RATE_DOT.UR },
          { label: 'R — standard', pct: '96.0%', dot: RATE_DOT.R },
        ],
  };
}

function BannerTile({ vm, active, onClick }) {
  return (
    <div className={`${styles.tile} ${active ? styles.tileActive : ''}`} onClick={onClick}>
      <div className={styles.tileArt} style={{ background: `linear-gradient(135deg, ${vm.accentA}, ${vm.accentB})` }}>
        <BannerKeyArt src={vm.keyArt} variant="tile" />
        <div className={styles.tileScrim} />
        <span
          className={styles.tileType}
          style={{
            background: vm.isComeback ? 'rgba(155,93,229,.92)' : 'rgba(234,163,28,.94)',
            color: vm.isComeback ? '#fff' : '#3a2600',
          }}
        >
          {vm.typeLabel}
        </span>
        <div className={styles.tileFooter}>
          <div className={styles.tileGroup}>{vm.group}</div>
          <div className={styles.tileTitle}>{vm.comeback}</div>
        </div>
      </div>
      <div className={styles.tileEnds}>{vm.endsIn ?? ''}</div>
    </div>
  );
}

export default function BannersPage() {
  const [me, setMe] = useState(null);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeId, setActiveId] = useState(null);
  const [rateUp, setRateUp] = useState({});
  const [ratesTarget, setRatesTarget] = useState(null); // bannerId | 'daily' | null
  const [sequence, setSequence] = useState(null);
  const [pity, setPity] = useState(null);
  const [pulling, setPulling] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [, setTick] = useState(0);            // 60s tick to refresh "ends in"
  const [dailyCd, setDailyCd] = useState('');  // header daily reset countdown

  const loadData = useCallback(async () => {
    try {
      const [meData, bannersData, pityData] = await Promise.all([
        getMe(), getBanners(), getPity().catch(() => null),
      ]);
      setMe(meData);
      setBanners(bannersData.banners);
      setPity(pityData);
      // Auto-select soloist banners' sole rate-up idol.
      const soloSel = {};
      for (const b of bannersData.banners) {
        const vm = bannerVM(b);
        if (vm.isSoloist && vm.members[0]) soloSel[b.id] = vm.members[0].idolId;
      }
      setRateUp(prev => ({ ...soloSel, ...prev }));
      const firstEvent = bannersData.banners.find(b => b.description !== 'daily');
      if (firstEvent) setActiveId(firstEvent.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const tick = () => setDailyCd(formatHMS(getNextReset() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const eventBanners = useMemo(() => banners.filter(b => b.description !== 'daily'), [banners]);
  const dailyBanner = useMemo(() => banners.find(b => b.description === 'daily'), [banners]);

  const vms = useMemo(() => eventBanners.map(bannerVM), [eventBanners]);
  const activeVm = vms.find(v => v.id === activeId) ?? vms[0] ?? null;
  const splitAt = Math.ceil(vms.length / 2);
  const leftVms = vms.slice(0, splitAt);
  const rightVms = vms.slice(splitAt);

  async function handlePull(count, isFree) {
    if (pulling || !activeVm) return;
    setPulling(true);
    try {
      const rateUpIdolId = rateUp[activeVm.id] ?? null;
      const result = await pullBanner(activeVm.id, rateUpIdolId, count);
      setSequence({ cards: result.cards, cinematic: true, group: activeVm.group, comeback: activeVm.comeback });
      if (isFree) {
        setBanners(prev => prev.map(b =>
          b.id === activeVm.id
            ? { ...b, freePullsRemaining: Math.max(0, (b.freePullsRemaining ?? 0) - count) }
            : b));
      } else {
        const cost = result.currencySpent ?? (count === 10 ? 9 : count);
        setMe(prev => prev ? { ...prev, ggCurrency: prev.ggCurrency - cost } : prev);
      }
      getPity().then(setPity).catch(() => {});
    } catch (err) {
      if (err.status === 402) {
        alert(`Not enough currency — you have ${err.body?.have ?? '?'}, need ${err.body?.need ?? '?'}.`);
      } else {
        alert(err.message || 'Pull failed. Try again.');
      }
    } finally {
      setPulling(false);
    }
  }

  async function handleDaily() {
    if (claimingDaily || !dailyBanner) return;
    setClaimingDaily(true);
    try {
      const result = await claimDailyPull(dailyBanner.genderCategory);
      setSequence({ cards: [result.card], cinematic: false });
      setMe(prev => prev ? {
        ...prev,
        dailyPullAvailable: { ...prev.dailyPullAvailable, [dailyBanner.genderCategory]: false },
      } : prev);
    } catch (err) {
      alert(err.message || 'Daily pull failed. Try again.');
    } finally {
      setClaimingDaily(false);
    }
  }

  if (loading) return <div className={styles.page}><p className={styles.hint}>Loading banners…</p></div>;
  if (error)   return <div className={styles.page}><p className={styles.err}>{error}</p></div>;

  const dailyAvailable = dailyBanner ? (me?.dailyPullAvailable?.[dailyBanner.genderCategory] ?? false) : false;
  const rates = ratesTarget != null
    ? ratesFor(ratesTarget, ratesTarget === 'daily' ? null : vms.find(v => v.id === ratesTarget))
    : null;

  return (
    <div className={styles.page}>
      {/* ── header ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>Banners</h1>

        {dailyBanner && (
          <div className={styles.dailyBar}>
            <span className={styles.dailyLabel}>Daily Summon</span>
            <span className={styles.dailyCd}>{dailyCd}</span>
            <button className={styles.dailyRates} onClick={() => setRatesTarget('daily')} title="Drop rates">%</button>
            <button
              className={styles.dailyFree}
              disabled={!dailyAvailable || claimingDaily}
              onClick={handleDaily}
            >
              {dailyAvailable ? (claimingDaily ? 'Pulling…' : 'Free Pull') : 'Claimed'}
            </button>
          </div>
        )}

        <div className={styles.currency}>
          <svg width="18" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="8" y="2" width="8" height="9" rx="4" fill="#f5c43d" />
            <rect x="10.5" y="10.5" width="3" height="8.5" rx="1.4" fill="#f5c43d" />
            <rect x="8.5" y="18.5" width="7" height="3.2" rx="1.6" fill="#eaa31c" />
          </svg>
          <span>{(me?.ggCurrency ?? 0).toLocaleString()}</span>
        </div>
      </div>

      {/* ── carousel ── */}
      {activeVm ? (
        <div className={styles.carousel}>
          <div className={styles.side}>
            {leftVms.map(vm => (
              <BannerTile key={vm.id} vm={vm} active={vm.id === activeVm.id} onClick={() => setActiveId(vm.id)} />
            ))}
          </div>

          <div className={styles.center}>
            <SummonPanel
              vm={activeVm}
              selectedIdolId={rateUp[activeVm.id] ?? null}
              onSelect={(idolId) => setRateUp(prev => ({ ...prev, [activeVm.id]: idolId }))}
              onPull={handlePull}
              onRates={() => setRatesTarget(activeVm.id)}
              currency={me?.ggCurrency ?? 0}
              pity={pity?.ur}
              pulling={pulling}
            />
          </div>

          <div className={styles.side}>
            {rightVms.map(vm => (
              <BannerTile key={vm.id} vm={vm} active={vm.id === activeVm.id} onClick={() => setActiveId(vm.id)} />
            ))}
          </div>
        </div>
      ) : (
        <p className={styles.hint}>No active event banners right now. Check back later.</p>
      )}

      {/* ── rates popup ── */}
      {rates && (
        <div className={styles.ratesOverlay} onClick={() => setRatesTarget(null)}>
          <div className={styles.ratesModal} onClick={e => e.stopPropagation()}>
            <div className={styles.ratesTop}>
              <div className={styles.ratesHeading}>Drop Rates</div>
              <button className={styles.ratesClose} onClick={() => setRatesTarget(null)}>✕</button>
            </div>
            <div className={styles.ratesSubtitle}>{rates.title}</div>
            <div className={styles.ratesRows}>
              {rates.rows.map(row => (
                <div key={row.label} className={styles.ratesRow}>
                  <span className={styles.ratesLabel}>
                    <span className={styles.ratesDot} style={{ background: row.dot }} />
                    {row.label}
                  </span>
                  <span className={styles.ratesPct}>{row.pct}</span>
                </div>
              ))}
            </div>
            <div className={styles.ratesNote}>
              Percentages are placeholder — final rates and the pity threshold are to be defined.
            </div>
          </div>
        </div>
      )}

      {/* ── summon reveal ── */}
      {sequence && (
        <SummonSequence
          cards={sequence.cards}
          cinematic={sequence.cinematic}
          group={sequence.group}
          comeback={sequence.comeback}
          onClose={() => setSequence(null)}
        />
      )}
    </div>
  );
}
