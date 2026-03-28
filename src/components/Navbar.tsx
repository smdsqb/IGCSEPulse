"use client";

import { useState } from "react";
import styles from "./Navbar.module.css";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { logout, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── About Modal ──────────────────────────────────────────────────────────────
function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>
        <h2 className={styles.modalTitle}>About IGCSE Pulse</h2>
        <p className={styles.modalSubtitle}>
          Built by students, for students. IGCSE Pulse is an AI-powered study platform tailored to the Cambridge IGCSE syllabus.
        </p>

        <div className={styles.teamGrid}>
          {/* ── Developer 1 ── */}
          <div className={styles.teamCard}>
            <div className={styles.teamAvatar}>👨‍💻</div>
            <div className={styles.teamName}>Shaik Mahammad Saqib</div>
            <div className={styles.teamRole}>Founder & Developer</div>
            <div className={styles.teamBio}>A guy who thought using AI to check his handwritten business studies answers during IGCSEs would be a genius move. Turns out, AI can't read chicken scratch. So he roped the other two into building this site instead. What you see here? Yeah, that's his revenge on bad handwriting</div>
          </div>

          {/* ── Developer 2 ── */}
          <div className={styles.teamCard}>
            <div className={styles.teamAvatar}>👨‍💻</div>
            <div className={styles.teamName}>Parth Sharma</div>
            <div className={styles.teamRole}>Co-Founder & Developer</div>
            <div className={styles.teamBio}>Absolute genius when it comes to anything with a keyboard. Also found out the hard way that his own handwriting was just as unreadable. IGCSEPulse? All his idea. He's the one keeping the website alive and feeding data to the AI—basically the wizard behind the curtain.</div>
          </div>

          {/* ── Investor ── */}
          <div className={styles.teamCard}>
            <div className={styles.teamAvatar}>💼</div>
            <div className={styles.teamName}>Arbaz Khan</div>
            <div className={styles.teamRole}>Investor & Supporter</div>
            <div className={styles.teamBio}>Another computer genius, currently doing his internship after graduating from poly. He graciously donates his wallet to cover storage and hosting costs, and swoops in like a hero whenever something catches fire.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Feedback Modal ───────────────────────────────────────────────────────────
const FEEDBACK_FEATURES = [
  "AI Tutor (Ask AI)",
  "Past Paper Upload",
  "Resources",
  "Dashboard",
  "Community",
  "Subjects",
  "General / Other",
];

function FeedbackModal({ onClose, userEmail }: { onClose: () => void; userEmail?: string }) {
  const [feature, setFeature] = useState(FEEDBACK_FEATURES[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit() {
    if (!message.trim()) { setError("Please write your feedback before sending."); return; }
    setSending(true);
    setError("");
    try {
      await addDoc(collection(db, "feedback"), {
        feature,
        message: message.trim(),
        userEmail: userEmail ?? "anonymous",
        createdAt: serverTimestamp(),
      });
      setSent(true);
    } catch (err) {
      console.error("Feedback save error:", err);
      setError("Failed to send feedback. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>
        <h2 className={styles.modalTitle}>Send Feedback</h2>
        <p className={styles.modalSubtitle}>
          We read every message. Tell us what's working, what's broken, or what you'd love to see.
        </p>

        {sent ? (
          <div className={styles.feedbackSuccess}>
            <div className={styles.feedbackSuccessIcon}>✓</div>
            <div className={styles.feedbackSuccessText}>Feedback sent! Thanks for helping us improve.</div>
            <button className={styles.feedbackDoneBtn} onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <label className={styles.feedbackLabel}>Feature</label>
            <select
              className={styles.feedbackSelect}
              value={feature}
              onChange={e => setFeature(e.target.value)}
            >
              {FEEDBACK_FEATURES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <label className={styles.feedbackLabel}>Your feedback</label>
            <textarea
              className={styles.feedbackTextarea}
              placeholder="Tell us anything — bugs, ideas, praise, complaints..."
              value={message}
              onChange={e => { setMessage(e.target.value); setError(""); }}
              rows={5}
            />

            {error && <div className={styles.feedbackError}>{error}</div>}

            <button
              className={styles.feedbackSubmit}
              onClick={handleSubmit}
              disabled={sending}
            >
              {sending ? "Sending..." : "Send Feedback"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Navbar ───────────────────────────────────────────────────────────────────
export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, loading }   = useAuth();
  const router              = useRouter();

  const [showAbout,    setShowAbout]    = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  const initials = user
    ? (user.displayName
        ? user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
        : user.email?.[0].toUpperCase() ?? "?")
    : "";

  return (
    <>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          IGCSE<span>Pulse</span>
        </Link>

        <div className={styles.navLinks}>
          <button className={styles.navTextBtn} onClick={() => setShowAbout(true)}>About</button>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/subjects">Subjects</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/ask-ai" className={styles.aiLink}>Ask AI ✦</Link>
          <button className={styles.navTextBtn} onClick={() => setShowFeedback(true)}>Feedback</button>
        </div>

        <div className={styles.navRight}>
          <div className={styles.themeToggle}>
            <button
              className={`${styles.ttBtn} ${theme === "dark" ? styles.active : ""}`}
              onClick={() => setTheme("dark")}
              title="Dark mode"
            >🌙</button>
            <button
              className={`${styles.ttBtn} ${theme === "light" ? styles.active : ""}`}
              onClick={() => setTheme("light")}
              title="Light mode"
            >☀️</button>
          </div>

          {!loading && (
            <>
              {user ? (
                <div className={styles.userMenu}>
                  <div className={styles.avatar} title={user.displayName ?? user.email ?? ""}>
                    {user.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.photoURL} alt="avatar" className={styles.avatarImg} />
                    ) : (
                      initials
                    )}
                  </div>
                  <button className={styles.logoutBtn} onClick={handleLogout}>Sign Out</button>
                </div>
              ) : (
                <>
                  <Link href="/login" className={styles.loginLink}>Sign In</Link>
                  <Link href="/signup" className={styles.navCta}>Join Free</Link>
                </>
              )}
            </>
          )}
        </div>
      </nav>

      {showAbout    && <AboutModal    onClose={() => setShowAbout(false)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} userEmail={user?.email ?? undefined} />}
    </>
  );
}
