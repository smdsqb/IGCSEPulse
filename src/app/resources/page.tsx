import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import styles from "./resources.module.css";

const resources = [
  {
    icon: "📘",
    title: "Textbooks",
    desc: "Curated reading materials and chapter summaries aligned to the IGCSE syllabus.",
    color: "colorPurple",
    tag: "Coming Soon",
  },
  {
    icon: "🗒️",
    title: "Revision Notes",
    desc: "Concise, student-written revision notes covering every topic in your syllabus.",
    color: "colorAmber",
    tag: "Coming Soon",
  },
  {
    icon: "🎯",
    title: "Examiner Reports",
    desc: "Learn what examiners say about common mistakes and how to avoid them in your answers.",
    color: "colorRed",
    tag: "Coming Soon",
  },
  {
    icon: "✦",
    title: "AI Explanations",
    desc: "Get any concept explained in plain English, tailored to your IGCSE syllabus, powered by AI.",
    color: "colorTeal",
    tag: "Powered by Groq API",
  },
];

export default function ResourcesPage() {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.badge}>
            <span className={styles.pulseDot} />
            Resources
          </div>
          <h1>
            Everything you need to <em>revise smart</em>
          </h1>
          <p>
            Past papers, mark schemes, notes, and AI-powered explanations —
            all in one place. Coming very soon.
          </p>
        </div>

        <div className={styles.grid}>
          {resources.map((res) => (
            <div key={res.title} className={`${styles.card} ${styles[res.color]}`}>
              <div className={styles.cardTop}>
                <div className={styles.icon}>{res.icon}</div>
                <span className={styles.comingSoon}>{res.tag}</span>
              </div>
              <div className={styles.cardName}>{res.title}</div>
              <div className={styles.cardDesc}>{res.desc}</div>
            </div>
          ))}
        </div>

        <div className={styles.notify}>
          <div className={styles.notifyInner}>
            <div className={styles.notifyIcon}>🔔</div>
            <div>
              <div className={styles.notifyTitle}>Get notified when resources drop</div>
              <div className={styles.notifyDesc}>Be the first to know when past papers and notes go live.</div>
            </div>
            <button className={styles.notifyBtn}>Notify Me</button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
