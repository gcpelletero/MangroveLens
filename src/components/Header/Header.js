import Link from 'next/link';
import Container from '@components/Container';
import styles from './Header.module.scss';

const Header = () => {
  return (
    <header className={styles.header}>
      <Container className={styles.headerContainer}>
        <div className={styles.headerTitle}>
          <Link href="/" style={{ textDecoration: 'none', color: 'white' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', lineHeight: '1.1' }}>
                MangroveLens
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                Web-Based Mangrove Monitoring Tool
              </div>
            </div>
          </Link>
        </div>

        <ul className={styles.headerLinks}>
          <li style={{ color: 'white', fontWeight: '500' }}>Palawan Pilot Area</li>
          <li style={{ color: 'white', fontWeight: '500' }}>NDVI & Decline View</li>
        </ul>
      </Container>
    </header>
  );
};

export default Header;