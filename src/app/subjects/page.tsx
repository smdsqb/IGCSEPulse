import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import styles from "./subjects.module.css";

const subjects = [
  {
    name: "English",
    subtitle: "First Language English",
    code: "0500",
    icon: "📖",
    color: "colorBlue",
  },
  {
    name: "Mathematics",
    subtitle: "Extended",
    code: "0580",
    icon: "📐",
    color: "colorPurple",
  },
  {
    name: "Computer Science",
    subtitle: "Core & Extended",
    code: "0478",
    icon: "💻",
    color: "colorGreen",
  },
  {
    name: "Business Studies",
    subtitle: "Core & Supplement",
    code: "0450",
    icon: "📊",
    color: "colorAmber",
  },
  {
    name: "Physics",
    subtitle: "Core & Extended",
    code: "0625",
    icon: "⚡",
    color: "colorRed",
  },
  {
    name: "Chemistry",
    subtitle: "Core & Extended",
    code: "0620",
    icon: "🧪",
    color: "colorTeal",
  },
];

export default function SubjectsPage() {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.badge}>
            <span className={styles.pulseDot} />
            Subjects
          </div>
          <h1>
            Your <em>subjects,</em> all in one place
          </h1>
          <p>
            Dedicated spaces for each subject — past papers, mark schemes, AI
            help, and community discussions. Launching soon.
          </p>
        </div>

        <div className={styles.grid}>
          {subjects.map((s) => (
            <div key={s.code} className={`${styles.card} ${styles[s.color]}`}>
              <div className={styles.cardTop}>
                <div className={styles.icon}>{s.icon}</div>
                <span className={styles.comingSoon}>Coming Soon</span>
              </div>
              <div className={styles.cardName}>{s.name}</div>
              <div className={styles.cardSub}>{s.subtitle}</div>
              <div className={styles.cardCode}>IGCSE · {s.code}</div>
              <div className={styles.cardFeatures}>
                <span>Past Papers</span>
                <span>Mark Schemes</span>
                <span>AI Help</span>
                <span>Community</span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.notify}>
          <div className={styles.notifyInner}>
            <div className={styles.notifyIcon}>🔔</div>
            <div>
              <div className={styles.notifyTitle}>Want to be notified when subjects launch?</div>
              <div className={styles.notifyDesc}>We&apos;ll let you know as soon as your subject is ready.</div>
            </div>
            <button className={styles.notifyBtn}>Notify Me</button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
