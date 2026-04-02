"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import styles from "./leaderboard.module.css";

interface LeaderEntry {
  uid: string;
  displayName: string;
  photoURL?: string;
  rep: number;
  streak: number;
  badges: string[];
}

const BADGE_META: Record<string, string> = {
  first_question: "🔥",
  streak_10: "📚",
  top_contributor: "⭐",
  community_regular: "💬",
  ai_master: "🧠",
};

export default function LeaderboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users"), orderBy("rep", "desc"), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setLeaders(snap.docs.map(d => ({ uid: d.id, ...d.data() } as LeaderEntry)));
      setFetching(false);
    });
    return unsub;
  }, [user]);

  if (loading || !user) return (
    <div className={styles.loadingScreen}><div className={styles.spinner} /></div>
  );

  function getInitials(name: string) {
    return (name ?? "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  }

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headerBadge}>🏆 Leaderboard</div>
          <h1>Top Students</h1>
          <p>Ranked by rep points earned through activity</p>
        </div>

        {fetching ? (
          <div className={styles.fetching}><div className={styles.spinner} /></div>
        ) : (
          <div className={styles.list}>
            {leaders.map((entry, i) => {
              const isMe = entry.uid === user.uid;
              const rank = i + 1;
              const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
              return (
                <div key={entry.uid} className={`${styles.row} ${isMe ? styles.rowMe : ""}`}>
                  <div className={styles.rank}>
                    {medal ? <span className={styles.medal}>{medal}</span> : <span className={styles.rankNum}>#{rank}</span>}
                  </div>
                  <div className={styles.avatar}>
                    {entry.photoURL
                      ? <img src={entry.photoURL} alt={entry.displayName} className={styles.avatarImg} />
                      : <div className={styles.avatarInitials}>{getInitials(entry.displayName)}</div>
                    }
                  </div>
                  <div className={styles.info}>
                    <div className={styles.name}>
                      {entry.displayName || "Anonymous"}
                      {isMe && <span className={styles.youTag}>You</span>}
                    </div>
                    <div className={styles.badges}>
                      {(entry.badges ?? []).map(b => BADGE_META[b] && (
                        <span key={b} title={b}>{BADGE_META[b]}</span>
                      ))}
                    </div>
                  </div>
                  <div className={styles.repWrap}>
                    <div className={styles.rep}>{entry.rep ?? 0}</div>
                    <div className={styles.repLabel}>rep</div>
                  </div>
                  <div className={styles.streakWrap}>
                    <div className={styles.streakVal}>🔥 {entry.streak ?? 0}</div>
                    <div className={styles.streakLabel}>streak</div>
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
