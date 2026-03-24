import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroText}>
        <div className={styles.heroBadge}>
          <span className={styles.pulseDot} />
          Live community · 2,400+ students
        </div>
        <h1>
          Your IGCSE doubts, <em>answered.</em>
        </h1>
        <p>
          A community + AI platform built for IGCSE students. Ask doubts, get
          mark scheme help, and connect with peers who actually get it.
        </p>
        <div className={styles.heroBtns}>
          <button className={styles.btnPrimary}>Join the Community</button>
          <button className={styles.btnOutline}>Browse Questions</button>
        </div>
      </div>

      <div className={styles.heroVisual}>
        <div className={styles.floatingCard}>
          <div className={styles.cardTop}>
            <div className={`${styles.avatar} ${styles.av1}`}>AK</div>
            <div>
              <div className={styles.cardName}>Ayaan Khan</div>
              <div className={styles.cardSub}>Chemistry · 2 min ago</div>
            </div>
          </div>
          <p className={styles.cardQ}>
            Why does activation energy decrease with a catalyst? The mark scheme
            says &quot;lowers Ea&quot; but I need a proper explanation.
          </p>
          <div className={styles.tags}>
            <span className={`${styles.tag} ${styles.tagChem}`}>Chemistry</span>
            <span className={styles.tag}>Marking Help</span>
          </div>
          <div className={styles.cardActions}>
            <button className={`${styles.fcBtn} ${styles.fcReply}`}>
              💬 Reply
            </button>
            <button className={`${styles.fcBtn} ${styles.fcAi}`}>
              ✦ Ask AI
            </button>
          </div>
        </div>

        <div className={styles.miniCards}>
          {[
            { num: "2.4k", label: "Students" },
            { num: "840", label: "Questions" },
            { num: "98%", label: "Resolved" },
          ].map((stat) => (
            <div key={stat.label} className={styles.miniCard}>
              <div className={styles.mcNum}>{stat.num}</div>
              <div className={styles.mcLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
