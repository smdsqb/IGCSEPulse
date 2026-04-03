"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, onSnapshot,
  doc, getDoc, addDoc, serverTimestamp, where, getDocs
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import styles from "./challenges.module.css";

const SUBJECTS = ["business", "math", "physics", "chemistry", "computer-science", "english"];

interface Challenge {
  id: string;
  title: string;
  question: string;
  subject: string;
  marks: number;
  difficulty: "easy" | "medium" | "hard";
  timeLimit: number; // minutes
  keywords: string[];
  createdAt: any;
  date: string;
}

interface Submission {
  challengeId: string;
  userId: string;
  answer: string;
  score: number;
  passed: boolean;
  submittedAt: any;
}

export default function ChallengePage() {
  const { user, loading, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [challenges, setChallenges]         = useState<Challenge[]>([]);
  const [fetching, setFetching]             = useState(true);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer]                 = useState("");
  const [timeLeft, setTimeLeft]             = useState(0);
  const [timerActive, setTimerActive]       = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [result, setResult]                 = useState<{ passed: boolean; score: number; feedback: string } | null>(null);
  const [submissions, setSubmissions]       = useState<Record<string, Submission>>({});
  const [filterSubject, setFilterSubject]   = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [searchQuery, setSearchQuery]       = useState("");
  const [started, setStarted]               = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Load challenges
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "challenges"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setChallenges(snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge)));
      setFetching(false);
    });
    return unsub;
  }, [user]);

  // Load user's submissions
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "challenge_submissions"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, Submission> = {};
      snap.docs.forEach(d => {
        const data = d.data() as Submission;
        map[data.challengeId] = data;
      });
      setSubmissions(map);
    });
    return unsub;
  }, [user]);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          handleSubmit(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  function startChallenge(challenge: Challenge) {
    setActiveChallenge(challenge);
    setAnswer("");
    setResult(null);
    setStarted(false);
    setTimeLeft(challenge.timeLimit * 60);
    setTimerActive(false);
  }

  function beginTimer() {
    setStarted(true);
    setTimerActive(true);
  }

  async function handleSubmit(autoSubmit = false) {
    if (!activeChallenge || !user) return;
    if (!answer.trim() && !autoSubmit) return;
    setSubmitting(true);
    setTimerActive(false);

    // Score based on keyword matching
    const answerLower = answer.toLowerCase();
    const matched = activeChallenge.keywords.filter(kw => answerLower.includes(kw.toLowerCase()));
    const score = Math.round((matched.length / activeChallenge.keywords.length) * activeChallenge.marks);
    const passed = score >= Math.ceil(activeChallenge.marks * 0.5);

    const feedback = passed
      ? `Great job! You matched ${matched.length}/${activeChallenge.keywords.length} key points. Score: ${score}/${activeChallenge.marks}`
      : `You matched ${matched.length}/${activeChallenge.keywords.length} key points. Score: ${score}/${activeChallenge.marks}. Keep practising!`;

    // Save submission
    await addDoc(collection(db, "challenge_submissions"), {
      challengeId: activeChallenge.id,
      userId: user.uid,
      answer: answer.trim(),
      score,
      passed,
      submittedAt: serverTimestamp(),
    });

    // Award rep if passed
    if (passed) {
      const { doc: firestoreDoc, updateDoc, increment } = await import("firebase/firestore");
      const userRef = firestoreDoc(db, "users", user.uid);
      const repGain = activeChallenge.difficulty === "hard" ? 20 : activeChallenge.difficulty === "medium" ? 10 : 5;
      await updateDoc(userRef, { rep: increment(repGain) });
      await refreshProfile();
    }

    setResult({ passed, score, feedback });
    setSubmitting(false);
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const filtered = challenges.filter(c => {
    if (filterSubject !== "all" && c.subject !== filterSubject) return false;
    if (filterDifficulty !== "all" && c.difficulty !== filterDifficulty) return false;
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase()) && !c.question.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const diffColor = (d: string) => d === "easy" ? styles.easy : d === "medium" ? styles.medium : styles.hard;

  if (loading || !user) return <div className={styles.loadingScreen}><div className={styles.spinner} /></div>;

  return (
    <>
      <Navbar />
      <main className={styles.main}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerBadge}>⚡ Challenge Corner</div>
          <h1>Daily Challenges</h1>
          <p>Test your IGCSE knowledge. Beat the timer. Earn rep.</p>
        </div>

        {/* Active challenge modal */}
        {activeChallenge && (
          <div className={styles.modalOverlay} onClick={() => { if (!started) { setActiveChallenge(null); } }}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className={styles.modalHeader}>
                <div className={styles.modalMeta}>
                  <span className={`${styles.diffBadge} ${diffColor(activeChallenge.difficulty)}`}>{activeChallenge.difficulty}</span>
                  <span className={styles.subjectBadge}>{activeChallenge.subject}</span>
                  <span className={styles.marksBadge}>{activeChallenge.marks} marks</span>
                </div>
                {started && (
                  <div className={`${styles.timer} ${timeLeft < 60 ? styles.timerDanger : ""}`}>
                    ⏱ {formatTime(timeLeft)}
                  </div>
                )}
                {!started && (
                  <button className={styles.modalClose} onClick={() => setActiveChallenge(null)}>✕</button>
                )}
              </div>

              <h2 className={styles.modalTitle}>{activeChallenge.title}</h2>
              <div className={styles.questionBox}>{activeChallenge.question}</div>

              {/* Result */}
              {result ? (
                <div className={`${styles.resultBox} ${result.passed ? styles.resultPass : styles.resultFail}`}>
                  <div className={styles.resultIcon}>{result.passed ? "🎉" : "📚"}</div>
                  <div className={styles.resultTitle}>{result.passed ? "Challenge Passed!" : "Keep Practising!"}</div>
                  <div className={styles.resultFeedback}>{result.feedback}</div>
                  {result.passed && (
                    <div className={styles.repGain}>
                      +{activeChallenge.difficulty === "hard" ? 20 : activeChallenge.difficulty === "medium" ? 10 : 5} rep earned!
                    </div>
                  )}
                  <button className={styles.doneBtn} onClick={() => setActiveChallenge(null)}>Done</button>
                </div>
              ) : !started ? (
                <div className={styles.startBox}>
                  <div className={styles.startWarning}>
                    ⚠️ Once you start, the timer begins. You cannot use AI to solve this.
                  </div>
                  <div className={styles.startInfo}>Time limit: {activeChallenge.timeLimit} minutes</div>
                  <button className={styles.startBtn} onClick={beginTimer}>Start Challenge ⚡</button>
                </div>
              ) : (
                <>
                  <textarea
                    className={styles.answerBox}
                    placeholder="Write your answer here..."
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    rows={8}
                  />
                  <button
                    className={styles.submitBtn}
                    onClick={() => handleSubmit(false)}
                    disabled={submitting || !answer.trim()}
                  >
                    {submitting ? "Checking..." : "Submit Answer"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            placeholder="Search challenges..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select className={styles.filterSelect} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
            <option value="all">All Subjects</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={styles.filterSelect} value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        {/* Challenge list */}
        {fetching ? (
          <div className={styles.fetching}><div className={styles.spinner} /></div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⚡</div>
            <div className={styles.emptyTitle}>No challenges yet</div>
            <div className={styles.emptySub}>Check back soon — new challenges drop daily!</div>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(c => {
              const sub = submissions[c.id];
              const done = !!sub;
              return (
                <div key={c.id} className={`${styles.card} ${done ? styles.cardDone : ""}`}>
                  <div className={styles.cardLeft}>
                    <div className={styles.cardMeta}>
                      <span className={`${styles.diffBadge} ${diffColor(c.difficulty)}`}>{c.difficulty}</span>
                      <span className={styles.subjectBadge}>{c.subject}</span>
                      <span className={styles.marksBadge}>{c.marks} marks</span>
                      <span className={styles.timeBadge}>⏱ {c.timeLimit}min</span>
                    </div>
                    <div className={styles.cardTitle}>{c.title}</div>
                    <div className={styles.cardQuestion}>{c.question.slice(0, 120)}{c.question.length > 120 ? "..." : ""}</div>
                  </div>
                  <div className={styles.cardRight}>
                    {done ? (
                      <div className={styles.doneTag}>
                        {sub.passed ? `✓ ${sub.score}/${c.marks}` : `✗ ${sub.score}/${c.marks}`}
                      </div>
                    ) : (
                      <button className={styles.attemptBtn} onClick={() => startChallenge(c)}>
                        Attempt ⚡
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
  }
