'use client';
import { useState, useEffect } from "react";
import styles from "./AiSection.module.css";
import { auth, onAuthStateChanged, type User } from "@/lib/firebase";

export default function AiSection() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("business");
  const [marks, setMarks] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const subjects = [
    { id: "business", name: "Business Studies", code: "0450" },
    { id: "math", name: "Mathematics", code: "0580" },
    { id: "physics", name: "Physics", code: "0625" },
    { id: "chemistry", name: "Chemistry", code: "0620" },
    { id: "computer-science", name: "Computer Science", code: "0478" },
    { id: "english", name: "English", code: "0500" },
  ];

  const askQuestion = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          subject,
          marks: marks ? parseInt(marks) : null,
          userId: user?.uid || null,
        }),
      });
      const data = await res.json();
      setAnswer(data.reply);
    } catch (error) {
      setAnswer("Sorry, something went wrong. Please try again.");
    }
    setLoading(false);
  };

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
          <button
            className={styles.askAiBtn}
            onClick={() => setShowChat(!showChat)}
          >
            ✦ {showChat ? "Hide" : "Ask AI"}
            {!showChat && (
              <span className={styles.askAiBadge}>Powered by DeepSeek</span>
            )}
          </button>
        </div>

        <div className={styles.chatMock}>
          {!showChat ? (
            <>
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
            </>
          ) : (
            <div className={styles.activeChat}>
              <div className={styles.subjectSelector}>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSubject(s.id)}
                    className={`${styles.subjectBtn} ${
                      subject === s.id ? styles.active : ""
                    }`}
                  >
                    <span>{s.name}</span>
                    <small>{s.code}</small>
                  </button>
                ))}
              </div>

              <select
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                className={styles.marksSelect}
              >
                <option value="">Select marks (optional)</option>
                <option value="2">2 marks</option>
                <option value="4">4 marks</option>
                <option value="6">6 marks</option>
                <option value="8">8 marks</option>
              </select>

              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask any IGCSE question... Example: 'Explain economies of scale (6 marks)'"
                rows={3}
                className={styles.questionInput}
              />

              <button
                onClick={askQuestion}
                disabled={loading}
                className={styles.sendBtn}
              >
                {loading ? "Thinking..." : "Ask AI Tutor"}
              </button>

              {answer && (
                <div className={styles.answerBox}>
                  <div className={styles.answerHeader}>📚 Answer</div>
                  <div className={styles.answerContent}>
                    {answer.split("\n").map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(answer)}
                    className={styles.copyBtn}
                  >
                    📋 Copy
                  </button>
                </div>
              )}

              <div className={styles.tipsBox}>
                <span>💡</span> Include mark value for better answers!
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
