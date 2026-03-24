import styles from "./Features.module.css";

const features = [
  {
    icon: "💬",
    iconClass: "fi1",
    title: "Student Community",
    desc: "Post your doubts, discuss topics, and help others. A space where IGCSE students actually understand your struggle.",
  },
  {
    icon: "✦",
    iconClass: "fi2",
    title: "Ask AI",
    badge: "Coming Soon",
    desc: "AI trained on IGCSE textbooks, past papers, mark schemes & examiner reports. Ask anything, get syllabus-accurate answers.",
  },
  {
    icon: "📄",
    iconClass: "fi3",
    title: "Mark Scheme Help",
    desc: "Understand exactly what examiners want. Get breakdowns of mark schemes with clear, student-friendly explanations.",
  },
];

export default function Features() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>What we offer</div>
      <div className={styles.sectionTitle}>Everything you need to ace IGCSE</div>
      <div className={styles.sectionSub}>
        From peer support to AI-powered marking help — all in one place.
      </div>
      <div className={styles.grid}>
        {features.map((f) => (
          <div key={f.title} className={styles.card}>
            <div className={`${styles.featIcon} ${styles[f.iconClass]}`}>
              {f.icon}
            </div>
            <div className={styles.featTitle}>
              {f.title}
              {f.badge && <span className={styles.badge}>{f.badge}</span>}
            </div>
            <div className={styles.featDesc}>{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
