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

          {/* AI Card — Coming Soon */}
          <div className={`${styles.card} ${styles.cardDisabled}`}>
            <div className={`${styles.cardIcon} ${styles.iconAi}`}>✦</div>
            <div className={styles.cardContent}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>Ask AI</div>
                <span className={styles.badge}>Coming Soon</span>
              </div>
              <div className={styles.cardDesc}>
                Your personal IGCSE tutor trained on past papers, mark
                schemes, and the full syllabus. Ask anything — get
                examiner-approved answers.
              </div>
              <div className={styles.cardStats}>
                <span>Textbooks</span>
                <span>·</span>
                <span>Past papers</span>
                <span>·</span>
                <span>Mark schemes</span>
              </div>
            </div>
            <div className={`${styles.cardArrow} ${styles.arrowMuted}`}>→</div>
          </div>

        </div>

        {/* Footer note */}
        <p className={styles.footNote}>
          More features dropping soon. Stay tuned.
        </p>
      </main>
    </>
  );
}
