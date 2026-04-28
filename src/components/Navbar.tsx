"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [hasNewUpdate, setHasNewUpdate] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Get user's lastSeenUpdates timestamp
    let lastSeen = 0;
    const userRef = doc(db, "users", user.uid);
    getDoc(userRef).then(snap => {
      if (snap.exists()) lastSeen = snap.data().lastSeenUpdates ?? 0;
    });

    // Watch for updates newer than lastSeen
    const q = query(collection(db, "updates"), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) { setHasNewUpdate(false); return; }
      const latest = snap.docs[0].data();
      const latestMs = latest.createdAt?.toMillis?.() ?? 0;
      // Re-read lastSeen from firestore for freshness
      getDoc(userRef).then(uSnap => {
        const seen = uSnap.exists() ? (uSnap.data().lastSeenUpdates ?? 0) : 0;
        setHasNewUpdate(latestMs > seen);
      });
    });
    return unsub;
  }, [user]);

  // Hide "New" badge when on /updates page
  useEffect(() => {
    if (pathname === "/updates") setHasNewUpdate(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <nav className={styles.nav}>
      <Link href="/dashboard" className={styles.logo}>
        IGCSEPulse
      </Link>

      <div className={styles.links}>
        {user && (
          <>
            <Link href="/dashboard"    className={pathname === "/dashboard"    ? styles.active : ""}>Dashboard</Link>
            <Link href="/community"    className={pathname === "/community"    ? styles.active : ""}>Community</Link>
            <Link href="/ask-ai"       className={pathname === "/ask-ai"       ? styles.active : ""}>Ask AI</Link>
            <Link href="/challenges"   className={pathname === "/challenges"   ? styles.active : ""}>Challenges</Link>
            <Link href="/leaderboard"  className={pathname === "/leaderboard"  ? styles.active : ""}>Leaderboard</Link>
            <Link href="/updates" className={`${styles.updatesLink} ${hasNewUpdate ? styles.updatesLinkNew : ""} ${pathname === "/updates" ? styles.active : ""}`}>
              Updates
              {hasNewUpdate && <span className={styles.newBadge}>New</span>}
            </Link>
          </>
        )}
      </div>

      <div className={styles.right}>
        {user ? (
          <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        ) : (
          <Link href="/login" className={styles.loginBtn}>Login</Link>
        )}
      </div>
    </nav>
  );
}
