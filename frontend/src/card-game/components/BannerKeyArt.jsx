import { useState, useEffect } from 'react';
import styles from './BannerKeyArt.module.css';

// Renders a banner's group key art, falling back to the striped "GROUP KEY ART"
// placeholder on error (or when no src). Image rendered visibly so cached images
// still show. See banner-art/README.md. Parent must be position:relative.
export default function BannerKeyArt({ src, variant = 'tile' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);

  const show = src && !failed;
  return (
    <div className={styles.wrap}>
      {!show && (
        <>
          <div className={styles.stripes} />
          <div className={`${styles.label} ${variant === 'hero' ? styles.labelHero : ''}`}>GROUP KEY ART</div>
        </>
      )}
      {show && <img src={src} alt="" className={styles.img} onError={() => setFailed(true)} />}
    </div>
  );
}
