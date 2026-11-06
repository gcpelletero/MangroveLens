import { useState } from 'react';
import Link from 'next/link';
import styles from './Header.module.scss';

export default function Header() {
  const [isAboutOpen,setIsAboutOpen]=useState(false);
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>Environmental Intelligence</div>
        <Link href="/" className={styles.title}>MangroveLens<span>.</span></Link>
        <div className={styles.subtitle}>Coastal change monitoring for Palawan, Philippines</div>
      </div>
      <div className={styles.actions}>
        <span className={styles.pilot}>Palawan pilot study</span>
        <button type="button" className={styles.aboutButton} onClick={()=>setIsAboutOpen(!isAboutOpen)}
          aria-expanded={isAboutOpen}>About this view</button>
      </div>
      {isAboutOpen && (
        <div className={styles.aboutPopup} role="dialog" aria-label="About this map">
          <button type="button" aria-label="Close" className={styles.close} onClick={()=>setIsAboutOpen(false)}>×</button>
          <strong>About MangroveLens</strong>
          <p>Explore provisional annual Sentinel-2 MVI-derived candidate mangrove extent for Palawan (2019–2025).</p>
          <p>GMW provides an independent same-year comparison reference, not field ground truth. The illustrated map shown before loading a layer is decorative only.</p>
        </div>
      )}
    </header>
  );
}
