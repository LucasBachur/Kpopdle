import { useState, useEffect } from 'react';
import styles from './CardPhoto.module.css';

// Card art for the dark banner/summon cards, falling back to the striped "PHOTO"
// placeholder only on error. The image is rendered visibly (no onLoad/display
// toggle) so cached images — e.g. a reveal card reusing art the summon panel
// already loaded — still show. Parent must be position:relative.
export default function CardPhoto({ artPath }) {
  const src = artPath ? `/cards/${artPath}` : null;
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) {
    return <div className={styles.wrap}><div className={styles.placeholder}>PHOTO</div></div>;
  }
  return (
    <div className={styles.wrap}>
      <img src={src} alt="" className={styles.img} onError={() => setFailed(true)} />
    </div>
  );
}
