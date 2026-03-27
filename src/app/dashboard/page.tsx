"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import styles from "./dashboard.module.css";
import Link from "next/link";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
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
          <h1>
            Hey, <em>{firstName}</em> 👋
          </h1>
          <p>What do you want to do today?</p>
        </div>

        {/* Two Option Cards */}
        <div className={styles.cards}>

          {/* Community Card */}
          <Link href="/community" className={styles.card}>
            <div className={`${styles.cardIcon} ${styles.iconCommunity}`}>
              💬
            </div>
            <div className={styles.cardContent}>
              <div className={styles.cardTitle}>Community</div>
              <div className={styles.cardDesc}>
                Ask doubts, help fellow students, discuss topics, and get
                mark scheme explanations from peers.
              </div>
              <div className={styles.cardStats}>
                <span>2,400+ students</span>
                <span>·</span>
                <span>840 questions</span>
                <span>·</span>
                <span className={styles.statGreen}>98% resolved</span>
              </div>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link>

          {/* AI Card — LIVE */}
          <Link href="/ask-ai" className={styles.card}>
            <div className={`${styles.cardIcon} ${styles.iconAi}`}>✦</div>
            <div className={styles.cardContent}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>Ask AI</div>
                <span className={`${styles.badge} ${styles.badgeLive}`}>Live ✦</span>
              </div>
              <div className={styles.cardDesc}>
                Your personal IGCSE tutor trained on the full syllabus, past
                papers and mark schemes. Ask anything — get examiner-accurate answers.
              </div>
              <div className={styles.cardStats}>
                <span>6 subjects</span>
                <span>·</span>
                <span>Powered by Groq API</span>
                <span>·</span>
                <span className={styles.statGreen}>Live now</span>
              </div>
            </div>
            <div className={styles.cardArrow}>→</div>
          </Link>

        </div>

        {/* Footer note */}
        <p className={styles.footNote}>
          More features dropping soon. Stay tuned.
        </p>
      </main>
    </>
  );
}
