import { useState, useEffect, useCallback } from 'react';
import { getMe, getBanners, pullBanner, claimDailyPull } from '../services/cardGameApi';
import BannerCard from '../components/BannerCard';
import DailyBannerCard from '../components/DailyBannerCard';
import GachaModal from '../components/GachaModal';
import styles from './BannersPage.module.css';

export default function BannersPage() {
  const [me, setMe] = useState(null);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalResults, setModalResults] = useState(null);
  const [pulling, setPulling] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [meData, bannersData] = await Promise.all([getMe(), getBanners()]);
      setMe(meData);
      setBanners(bannersData.banners);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDailyClaim(genderCategory) {
    if (claimingDaily) return;
    setClaimingDaily(true);
    try {
      const result = await claimDailyPull(genderCategory);
      setModalResults([result.card]);
      setMe(prev => prev ? {
        ...prev,
        dailyPullAvailable: { ...prev.dailyPullAvailable, [genderCategory]: false },
      } : prev);
    } catch (err) {
      alert(err.message || 'Daily pull failed. Try again.');
    } finally {
      setClaimingDaily(false);
    }
  }

  async function handlePull(bannerId, rateUpIdolId, count, isFree) {
    if (pulling) return;
    setPulling(true);
    try {
      const result = await pullBanner(bannerId, rateUpIdolId, count);
      setModalResults(result.cards);
      if (isFree) {
        setBanners(prev => prev.map(b =>
          b.id === bannerId
            ? { ...b, freePullsRemaining: Math.max(0, (b.freePullsRemaining ?? 0) - count) }
            : b
        ));
      } else {
        const cost = result.currencySpent ?? (count === 10 ? 9 : count);
        setMe(prev => prev ? { ...prev, ggCurrency: prev.ggCurrency - cost } : prev);
      }
    } catch (err) {
      if (err.status === 402) {
        alert(`Not enough currency — you have ${err.body?.have ?? '?'} 💎, need ${err.body?.need ?? '?'} 💎.`);
      } else {
        alert(err.message || 'Pull failed. Try again.');
      }
    } finally {
      setPulling(false);
    }
  }

  if (loading) return <div className={styles.page}><p className={styles.hint}>Loading banners…</p></div>;
  if (error)   return <div className={styles.page}><p className={styles.err}>{error}</p></div>;

  const dailyBanners  = banners.filter(b => b.description === 'daily');
  const regularBanners = banners.filter(b => b.description !== 'daily');

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <h1 className={styles.title}>Banners</h1>
        {me && <span className={styles.currency}>💎 {me.ggCurrency}</span>}
      </div>

      {dailyBanners.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Daily</h2>
          <div className={styles.grid}>
            {dailyBanners.map(banner => (
              <DailyBannerCard
                key={banner.id}
                banner={banner}
                isAvailable={me?.dailyPullAvailable?.[banner.genderCategory] ?? false}
                onClaim={() => handleDailyClaim(banner.genderCategory)}
                claiming={claimingDaily}
              />
            ))}
          </div>
        </div>
      )}

      {regularBanners.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Event Banners</h2>
          <div className={styles.grid}>
            {regularBanners.map(banner => (
              <BannerCard
                key={banner.id}
                banner={banner}
                userCurrency={me?.ggCurrency ?? 0}
                onPull={handlePull}
                pulling={pulling}
              />
            ))}
          </div>
        </div>
      )}

      {dailyBanners.length === 0 && regularBanners.length === 0 && (
        <p className={styles.hint}>No active banners right now. Check back later.</p>
      )}

      {modalResults && (
        <GachaModal
          title="Pull Results"
          results={modalResults}
          onClose={() => setModalResults(null)}
        />
      )}
    </div>
  );
}
