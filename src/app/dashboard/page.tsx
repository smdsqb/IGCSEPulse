"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import styles from "./dashboard.module.css";
import Link from "next/link";

export default function DashboardPage() {
  const { user, loading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user) return null;

  const firstName = user.displayName
    ? user.displayName.split(" ")[0]
    : user.email?.split("@")[0] ?? "there";

  return (
    <>
      <Navbar />
      <main className={styles.main}>

        {/* Greeting */}
        <div className={styles.greeting}>
          <div className={styles.greetingBadge}>
            <span className={styles.pulseDot} />
            Dashboard
          </div>
          <h1>Hey, <em>{firstName}</em> 👋</h1>
          <p>What do you want to do today?</p>
        </div>

        {/* Stats row */}
        {profile && (
          <div className={styles.statsRow}>
            <div className={styles.statPill}>🔥 {profile.streak ?? 0} day streak</div>
            <div className={styles.statPill}>⭐ {profile.rep ?? 0} rep</div>
            <div className={styles.statPill}>🏅 {(profile.badges ?? []).length} badges</div>
          </div>
        )}

        {/* Cards */}
        <div className={styles.cards}>

          <Link href="/community" className={styles.card}>
            <div className={`${styles.cardIcon} ${styles.iconCommunity}`}>💬</div>
            <div className={styles.cardContent}>
              <div className={styles.cardTitle}>Community</div>
              <div className={styles.cardDesc}>Ask doubts, help fellow students, discuss topics, and get mark scheme explanations from peers.</div>
              <div className={styles.cardStats}>
                <span>2,400+ students</span><span>·</span>
                <span>840 questions</span><span>·</span>
                <span className={styles.statGreen}>98% resolved</span>
              </div>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link>

          <Link href="/ask-ai" className={styles.card}>
            <div className={`${styles.cardIcon} ${styles.iconAi}`}>✦</div>
            <div className={styles.cardContent}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>Ask AI</div>
                <span className={`${styles.badge} ${styles.badgeLive}`}>Live ✦</span>
              </div>
              <div className={styles.cardDesc}>Your personal IGCSE tutor trained on the full syllabus, past papers and mark schemes.</div>
              <div className={styles.cardStats}>
                <span>6 subjects</span><span>·</span>
                <span>Powered by Groq</span><span>·</span>
                <span className={styles.statGreen}>Live now</span>
              </div>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link>

          {/* <Link href="/subjects" className={styles.card}>
            <div className={`${styles.cardIcon} ${styles.iconSubjects}`}>📚</div>
            <div className={styles.cardContent}>
              <div className={styles.cardTitle}>Subjects</div>
              <div className={styles.cardDesc}>Browse all IGCSE subjects, explore syllabus breakdowns, and find topic-specific study material.</div>
              <div className={styles.cardStats}>
                <span>All IGCSE subjects</span><span>·</span>
                <span className={styles.statGreen}>Syllabus mapped</span>
              </div>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link> */}

          <Link href="/resources" className={styles.card}>
            <div className={`${styles.cardIcon} ${styles.iconResources}`}>🗂️</div>
            <div className={styles.cardContent}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>Resources</div>
                <span className={`${styles.badge} ${styles.badgeNew}`}>New</span>
              </div>
              <div className={styles.cardDesc}>Notes, books and revision guides — everything in one place.</div>
              <div className={styles.cardStats}>
                <span>Past papers</span><span>·</span>
                <span>Mark schemes</span><span>·</span>
                <span className={styles.statGreen}>Free access</span>
              </div>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link>

          <Link href="/challenges" className={styles.card}>
            <div className={`${styles.cardIcon} ${styles.iconChallenge}`}>⚡</div>
            <div className={styles.cardContent}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>Challenge Corner</div>
                <span className={`${styles.badge} ${styles.badgeNew}`}>New</span>
              </div>
              <div className={styles.cardDesc}>Daily timed challenges to test your IGCSE knowledge. Earn rep, unlock badges, beat the clock.</div>
              <div className={styles.cardStats}>
                <span>Timed challenges</span><span>·</span>
                <span>Earn rep</span><span>·</span>
                <span className={styles.statGreen}>New daily</span>
              </div>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link>

          <Link href="/leaderboard" className={styles.card}>
            <div className={`${styles.cardIcon} ${styles.iconLeaderboard}`}>🏆</div>
            <div className={styles.cardContent}>
              <div className={styles.cardTitle}>Leaderboard</div>
              <div className={styles.cardDesc}>See where you rank among all IGCSE Pulse students. Climb the board by earning rep.</div>
              <div className={styles.cardStats}>
                <span>Top 20 students</span><span>·</span>
                <span className={styles.statGreen}>Live rankings</span>
              </div>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link>

        </div>

        <p className={styles.footNote}>More features dropping soon. Stay tuned.</p>
      </main>
    </>
  );
}
