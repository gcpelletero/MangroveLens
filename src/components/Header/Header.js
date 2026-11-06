import Link from 'next/link';
import styles from './Header.module.scss';

export default function Header() {
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>ENVIRONMENTAL INTELLIGENCE</div>
        <Link href="/" className={styles.title}>MangroveLens<span>.</span></Link>
        <div className={styles.subtitle}>Coastal change monitoring for Palawan, Philippines</div>
      </div>
      <div className={styles.pilot}>Palawan pilot study</div>
    </header>
  );
}
