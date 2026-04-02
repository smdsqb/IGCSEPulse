"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import styles from "./profile.module.css";

const BADGE_META: Record<string, { icon: string; label: string; desc: string }> = {
  first_question:    { icon: "🔥", label: "First Question",      desc: "Asked your first AI question" },
  streak_10:         { icon: "📚", label: "10 Day Streak",        desc: "Used IGCSEPulse 10 days in a row" },
  top_contributor:   { icon: "⭐", label: "Top Contributor",      desc: "Earned 500 rep points" },
  community_regular: { icon: "💬", label: "Community Regular",    desc: "Sent 50 community messages" },
  ai_master:         { icon: "🧠", label: "AI Master",            desc: "Asked 100 AI questions" },
};

const ALL_BADGES = Object.keys(BADGE_META);

export default function ProfilePage() {
  const { user, loading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user || !profile) return (
    <div className={styles.loadingScreen}><div className={styles.spinner} /></div>
  );

  const firstName = user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Student";
  const initials = user.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user.email?.[0].toUpperCase() ?? "?";

  const earnedBadges = profile.badges ?? [];
  const streakDays = profile.streak ?? 0;
  const rep = profile.rep ?? 0;
  const aiCount = (profile as any).aiQuestionCount ?? 0;
  const msgCount = (profile as any).communityMessageCount ?? 0;

  return (
    <>
      <Navbar />
      <main className={styles.main}>

        {/* Profile Header */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            {user.photoURL
              ? <img src={user.photoURL} alt="avatar" className={styles.avatarImg} />
              : <div className={styles.avatarInitials}>{initials}</div>
            }
          </div>
          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>{user.displayName ?? firstName}</h1>
            <div className={styles.profileEmail}>{user.email}</div>
            <div className={styles.profileStats}>
              <div className={styles.stat}>
                <div className={styles.statVal}>{rep}</div>
                <div className={styles.statLabel}>Rep Points</div>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <div className={styles.statVal}>{streakDays}</div>
                <div className={styles.statLabel}>Day Streak</div>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <div className={styles.statVal}>{aiCount}</div>
                <div className={styles.statLabel}>AI Questions</div>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <div className={styles.statVal}>{msgCount}</div>
                <div className={styles.statLabel}>Messages</div>
              </div>
            </div>
          </div>
        </div>

        {/* Streak Tracker */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>🔥 Streak Tracker</div>
          <div className={styles.streakCard}>
            <div className={styles.streakNumber}>{streakDays}</div>
            <div className={styles.streakLabel}>day{streakDays !== 1 ? "s" : ""} in a row</div>
            <div className={styles.streakDots}>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className={`${styles.streakDot} ${i < Math.min(streakDays, 7) ? styles.streakDotActive : ""}`} />
              ))}
            </div>
            <div className={styles.streakHint}>
              {streakDays === 0 ? "Start your streak today!" : streakDays >= 10 ? "You're on fire! 🔥" : `${10 - streakDays} more days to earn the 10 Day Streak badge!`}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>🏅 Badges</div>
          <div className={styles.badgeGrid}>
            {ALL_BADGES.map((key) => {
              const meta = BADGE_META[key];
              const earned = earnedBadges.includes(key);
              return (
                <div key={key} className={`${styles.badgeCard} ${earned ? styles.badgeEarned : styles.badgeLocked}`}>
                  <div className={styles.badgeIcon}>{earned ? meta.icon : "🔒"}</div>
                  <div className={styles.badgeLabel}>{meta.label}</div>
                  <div className={styles.badgeDesc}>{meta.desc}</div>
                  {earned && <div className={styles.badgeEarnedTag}>Earned ✓</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Subject Badges */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>📚 Joined Subjects</div>
          <div className={styles.subjectBadges}>
            {(profile.joinedSubjects ?? []).length === 0 && (
              <div className={styles.emptyState}>No subjects joined yet. Join communities to get subject badges!</div>
            )}
            {(profile.joinedSubjects ?? []).map((s: string) => (
              <div key={s} className={styles.subjectBadge}>{s}</div>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}
