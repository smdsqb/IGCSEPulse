"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import styles from "./updates.module.css";

interface Update {
  id: string;
  title: string;
  body: string;
  badge: string;
  createdAt: Timestamp | null;
}

const BADGE_COLORS: Record<string, string> = {
  "New Feature":   "rgba(155,127,212,0.18)",
  "Improvement":   "rgba(0,201,167,0.15)",
  "Bug Fix":       "rgba(255,77,109,0.15)",
  "Announcement":  "rgba(255,193,7,0.15)",
  "Coming Soon":   "rgba(59,130,246,0.15)",
};
const BADGE_TEXT: Record<string, string> = {
  "New Feature":   "#9B7FD4",
  "Improvement":   "#00C9A7",
  "Bug Fix":       "#FF4D6D",
  "Announcement":  "#FFC107",
  "Coming Soon":   "#3B82F6",
};

function formatDate(ts: Timestamp | null) {
  if (!ts) return "";
  return ts.toDate().toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
}

export default function UpdatesPage() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Mark as read when user visits
  useEffect(() => {
    if (!user) return;
    setDoc(doc(db, "users", user.uid), { lastSeenUpdates: Date.now() }, { merge: true });
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, "updates"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Update)));
      setLoaded(true);
    });
    return unsub;
  }, []);

  // Intersection observer for scroll-in animations
  useEffect(() => {
    if (!loaded) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.id;
            if (id) setVisibleIds(prev => new Set([...prev, id]));
          }
        });
      },
      { threshold: 0.12 }
    );
    cardRefs.current.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [loaded, updates]);

  return (
    <>
      <Navbar />
      <div className={styles.page}>
        {/* Ambient background blobs */}
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />

        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.heroBadge}>
            <span className={styles.heroDot} />
            What&apos;s New
          </div>
          <h1 className={styles.heroTitle}>
            Updates &<br /><span className={styles.heroAccent}>Changelog</span>
          </h1>
          <p className={styles.heroSub}>
            Everything new, improved, and coming soon to IGCSEPulse.
          </p>
        </div>

        {/* Timeline */}
        <div className={styles.timeline}>
          {!loaded && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
            </div>
          )}
          {loaded && updates.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>✦</div>
              <p>No updates posted yet. Check back soon.</p>
            </div>
          )}
          {updates.map((update, i) => (
            <div
              key={update.id}
              data-id={update.id}
              ref={el => { if (el) cardRefs.current.set(update.id, el); }}
              className={`${styles.card} ${visibleIds.has(update.id) ? styles.cardVisible : ""}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              {/* Timeline dot + line */}
              <div className={styles.timelineTrack}>
                <div className={styles.timelineDot} />
                {i < updates.length - 1 && <div className={styles.timelineLine} />}
              </div>

              <div className={styles.cardInner}>
                <div className={styles.cardMeta}>
                  <span
                    className={styles.badgePill}
                    style={{
                      background: BADGE_COLORS[update.badge] ?? "rgba(155,127,212,0.15)",
                      color: BADGE_TEXT[update.badge] ?? "#9B7FD4",
                    }}
                  >
                    {update.badge}
                  </span>
                  <span className={styles.cardDate}>{formatDate(update.createdAt)}</span>
                </div>

                <h2 className={styles.cardTitle}>{update.title}</h2>

                <div className={styles.cardBody}>
                  {update.body.split("\n").filter(Boolean).map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerDot} />
          <span>End of changelog</span>
          <span className={styles.footerDot} />
        </div>
      </div>
    </>
  );
}
