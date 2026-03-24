import styles from "./AiSection.module.css";

export default function AiSection() {
  return (
    <section className={styles.wrapper}>
      <div className={styles.aiSection}>
        <div className={styles.aiGlow} />
        <div className={styles.aiText}>
          <div className={styles.sectionLabel}>AI-Powered</div>
          <div className={styles.sectionTitle}>Your personal IGCSE tutor</div>
          <div className={styles.sectionSub}>
            Trained on the full IGCSE syllabus, official past papers, and mark
            schemes. Ask doubts in plain English, get answers the examiner would
            approve.
          </div>
          <button className={styles.askAiBtn}>
            ✦ Ask AI
            <span className={styles.askAiBadge}>Coming Soon</span>
          </button>
        </div>

        <div className={styles.chatMock}>
          <div className={styles.chatMsg}>
            <div className={`${styles.chatAvatar} ${styles.caUser}`}>P</div>
            <div className={`${styles.chatBubble} ${styles.cbUser}`}>
              How do I answer a 6-mark explain question for Business Studies?
            </div>
          </div>
          <div className={`${styles.chatMsg} ${styles.aiMsg}`}>
            <div className={`${styles.chatAvatar} ${styles.caAi}`}>✦</div>
            <div className={`${styles.chatBubble} ${styles.cbAi}`}>
              For 6-mark questions:{" "}
              <strong>Point → Evidence → Explain → Evaluate.</strong> Clear
              statement, back with data, explain the link, evaluate impact. Aim
              for 2–3 developed points.
            </div>
          </div>
          <div className={styles.chatMsg}>
            <div className={`${styles.chatAvatar} ${styles.caUser}`}>P</div>
            <div className={`${styles.chatBubble} ${styles.cbUser}`}>
              Can you show me an example answer?
            </div>
          </div>
          <div className={`${styles.chatMsg} ${styles.aiMsg}`}>
            <div className={`${styles.chatAvatar} ${styles.caAi}`}>✦</div>
            <div className={`${styles.chatBubble} ${styles.cbAi}`}>
              <div className={styles.typing}>
                <div className={styles.dot} />
                <div className={styles.dot} />
                <div className={styles.dot} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
