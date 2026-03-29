import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import styles from "./resources.module.css";

const resources = [
  {
    icon: "📘",
    title: "Textbooks",
    desc: "Curated reading materials and chapter summaries aligned to the IGCSE syllabus.",
    color: "colorPurple",
    tag: "Live",
    href: "/resources/textbooks",
    live: true,
  },
  {
    icon: "🗒️",
    title: "Revision Notes",
    desc: "Concise revision notes covering every topic in your syllabus.",
    color: "colorAmber",
    tag: "Live",
    href: "/resources/revision-notes",
    live: true,
  },
  {
    icon: "✦",
    title: "AI Explanations",
    desc: "Get any concept explained in plain English, tailored to your IGCSE syllabus, powered by AI.",
    color: "colorTeal",
    tag: "Powered by Groq API",
    href: "/ask-ai",
    live: true,
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
            Textbooks, revision notes, and AI-powered explanations — all in one place.
          </p>
        </div>

        <div className={styles.grid}>
          {resources.map((res) => (
            <Link
              key={res.title}
              href={res.href}
              className={`${styles.card} ${styles[res.color]} ${styles.cardLink}`}
            >
              <div className={styles.cardTop}>
                <div className={styles.icon}>{res.icon}</div>
                <span className={`${styles.comingSoon} ${res.live ? styles.tagLive : ""}`}>
                  {res.tag}
                </span>
              </div>
              <div className={styles.cardName}>{res.title}</div>
              <div className={styles.cardDesc}>{res.desc}</div>
              <div className={styles.cardArrow}>→</div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
