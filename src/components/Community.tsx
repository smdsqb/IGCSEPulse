import styles from "./Community.module.css";

const posts = [
  {
    initials: "SR",
    avatarClass: "av2",
    name: "Sara R.",
    subject: "Biology",
    time: "5m ago",
    question:
      "What's the difference between active and passive transport? I keep mixing them up in essays.",
    tags: [{ label: "Biology", cls: "tagBio" }, { label: "Core Concepts" }],
    replies: 8,
    likes: 14,
    resolved: true,
  },
  {
    initials: "KM",
    avatarClass: "av3",
    name: "Kieran M.",
    subject: "Maths",
    time: "22m ago",
    question:
      "How do I find the area under a velocity-time graph for non-uniform acceleration?",
    tags: [{ label: "Maths", cls: "tagMath" }, { label: "Past Paper" }],
    replies: 3,
    likes: 7,
    resolved: false,
  },
  {
    initials: "NJ",
    avatarClass: "av4",
    name: "Nadia J.",
    subject: "Economics",
    time: "1h ago",
    question:
      "Does the mark scheme accept PED answers without a diagram? Paper 2 Oct/Nov 22.",
    tags: [{ label: "Economics" }, { label: "Marking Help" }],
    replies: 5,
    likes: 11,
    resolved: true,
  },
];

const subjects = [
  { name: "Chemistry", count: 234, color: "#FF4D6D" },
  { name: "Biology", count: 198, color: "#9B7FD4" },
  { name: "Mathematics", count: 176, color: "#6482FF" },
  { name: "Physics", count: 155, color: "#00C9A7" },
  { name: "Economics", count: 112, color: "#FFB300" },
  { name: "Business Studies", count: 98, color: "#888" },
];

const contributors = [
  { initials: "AK", avatarClass: "av1", name: "Ayaan K.", answers: 142 },
  { initials: "SR", avatarClass: "av2", name: "Sara R.", answers: 98 },
  { initials: "KM", avatarClass: "av3", name: "Kieran M.", answers: 77 },
];

export default function Community() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>Community</div>
      <div className={styles.sectionTitle}>Join the conversation</div>
      <div className={styles.sectionSub}>
        Real questions from real IGCSE students, answered by peers and soon —
        by AI.
      </div>

      <div className={styles.grid}>
        <div className={styles.posts}>
          {posts.map((post) => (
            <div key={post.name + post.time} className={styles.postCard}>
              <div className={styles.postHeader}>
                <div className={styles.postUser}>
                  <div className={`${styles.avatar} ${styles[post.avatarClass]}`}>
                    {post.initials}
                  </div>
                  <div>
                    <div className={styles.cardName}>{post.name}</div>
                    <div className={styles.cardSub}>{post.subject}</div>
                  </div>
                </div>
                <div className={styles.postTime}>{post.time}</div>
              </div>
              <div className={styles.postQ}>{post.question}</div>
              <div className={styles.tags}>
                {post.tags.map((t) => (
                  <span
                    key={t.label}
                    className={`${styles.tag} ${t.cls ? styles[t.cls] : ""}`}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
              <div className={styles.postFooter}>
                <span className={styles.pfItem}>💬 {post.replies} replies</span>
                <span className={styles.pfItem}>👍 {post.likes}</span>
                {post.resolved && (
                  <span className={`${styles.pfItem} ${styles.resolved}`}>
                    ✓ Resolved
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <div className={styles.sbTitle}>Popular Subjects</div>
            {subjects.map((s) => (
              <div key={s.name} className={styles.subjectRow}>
                <div>
                  <span
                    className={styles.subjDot}
                    style={{ background: s.color }}
                  />
                  <span className={styles.subjName}>{s.name}</span>
                </div>
                <span className={styles.subjCount}>{s.count} posts</span>
              </div>
            ))}
          </div>

          <div className={styles.sidebarCard}>
            <div className={styles.sbTitle}>Top Contributors</div>
            <div className={styles.contributorList}>
              {contributors.map((c) => (
                <div key={c.name} className={styles.contributor}>
                  <div className={`${styles.avatar} ${styles[c.avatarClass]} ${styles.avatarSm}`}>
                    {c.initials}
                  </div>
                  <div>
                    <div className={styles.cardName}>{c.name}</div>
                    <div className={styles.cardSub}>{c.answers} answers</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
