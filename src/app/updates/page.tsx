"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import Navbar from "@/components/Navbar";
import styles from "./updates.module.css";

interface Update {
  id: string;
  title: string;
  body: string;
  badge?: string;
  createdAt: any;
}

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    // Mark updates as read
    localStorage.setItem("igcsepulse_updates_read", Date.now().toString());

    const q = query(collection(db, "updates"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Update)));
      setLoading(false);
    });
    return unsub;
  }, []);

  // Intersection Observer for staggered reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.id;
            if (id) setVisible(prev => new Set([...prev, id]));
          }
        });
      },
      { threshold: 0.15 }
    );

    cardRefs.current.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [updates]);

  function formatDate(ts: any) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  return (
    <>
      <Navbar />
      <div className={styles.page}>
        {/* ── HERO ─────────────────────────────────────────────── */}
        <div className={styles.hero}>
          <div className={styles.heroOrb1} />
          <div className={styles.heroOrb2} />
          <div className={styles.heroOrb3} />
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>
              <span className={styles.heroDot} />
              What&apos;s New
            </div>
            <h1 className={styles.heroTitle}>
              Updates &amp;<br />
              <span className={styles.heroAccent}>Release Notes</span>
            </h1>
            <p className={styles.heroSub}>
              New features, improvements, and fixes — straight from the team.
            </p>
          </div>
          <div className={styles.heroDivider} />
        </div>

        {/* ── CONTENT ──────────────────────────────────────────── */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadWrap}>
              <div className={styles.loadPulse} />
              <div className={styles.loadPulse} style={{ animationDelay: "0.15s" }} />
              <div className={styles.loadPulse} style={{ animationDelay: "0.3s" }} />
            </div>
          ) : updates.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🚀</div>
              <div className={styles.emptyTitle}>Nothing yet</div>
              <div className={styles.emptySub}>Check back soon — updates drop regularly.</div>
            </div>
          ) : (
            <div className={styles.timeline}>
              {updates.map((update, i) => (
                <div
                  key={update.id}
                  ref={el => { if (el) cardRefs.current.set(update.id, el); }}
                  data-id={update.id}
                  className={`${styles.card} ${visible.has(update.id) ? styles.cardVisible : ""}`}
                  style={{ transitionDelay: `${i * 0.05}s` }}
                >
                  {/* Line connector */}
                  <div className={styles.connector}>
                    <div className={styles.connectorDot} />
                    {i < updates.length - 1 && <div className={styles.connectorLine} />}
                  </div>

                  <div className={styles.cardInner}>
                    <div className={styles.cardMeta}>
                      {update.badge && (
                        <span className={styles.badge}>{update.badge}</span>
                      )}
                      <span className={styles.date}>{formatDate(update.createdAt)}</span>
                    </div>
                    <h2 className={styles.cardTitle}>{update.title}</h2>
                    <div className={styles.cardBody}>{update.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
