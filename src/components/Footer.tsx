import styles from "./Footer.module.css";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <Link href="/" className={styles.logo}>
        IGCSE<span>Pulse</span>
      </Link>
      <p>Built by students, for students. · Community + AI-powered IGCSE help</p>
    </footer>
  );
}
