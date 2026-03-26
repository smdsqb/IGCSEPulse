"use client";

import styles from "./Navbar.module.css";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { logout } from "@/lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  // Get initials from display name or email
  const initials = user
    ? (user.displayName
        ? user.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
        : user.email?.[0].toUpperCase() ?? "?")
    : "";

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.logo}>
        IGCSE<span>Pulse</span>
      </Link>

      <div className={styles.navLinks}>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/subjects">Subjects</Link>
        <Link href="/resources">Resources</Link>
        <Link href="/ask-ai" className={styles.aiLink}>
          Ask AI ✦
        </Link>
      </div>

      <div className={styles.navRight}>
        <div className={styles.themeToggle}>
          <button
            className={`${styles.ttBtn} ${theme === "dark" ? styles.active : ""}`}
            onClick={() => setTheme("dark")}
            title="Dark mode"
          >
            🌙
          </button>
          <button
            className={`${styles.ttBtn} ${theme === "light" ? styles.active : ""}`}
            onClick={() => setTheme("light")}
            title="Light mode"
          >
            ☀️
          </button>
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
                <button className={styles.logoutBtn} onClick={handleLogout}>
                  Sign Out
                </button>
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
  );
}
