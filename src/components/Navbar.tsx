"use client";

import styles from "./Navbar.module.css";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { logout } from "@/lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    await logout();
    router.push("/");
    setMenuOpen(false);
    setDropdownOpen(false);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user
    ? (user.displayName
        ? user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
        : user.email?.[0].toUpperCase() ?? "?")
    : "";

  return (
    <>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo} onClick={() => setMenuOpen(false)}>
          IGCSE<span>Pulse</span>
        </Link>

        {/* Desktop links */}
        <div className={styles.navLinks}>
          <Link href="/about">About</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/subjects">Subjects</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/ask-ai" className={styles.aiLink}>Ask AI ✦</Link>
          <Link href="/feedback">Feedback</Link>
        </div>

        <div className={styles.navRight}>
          <div className={styles.themeToggle}>
            <button className={`${styles.ttBtn} ${theme === "dark" ? styles.active : ""}`} onClick={() => setTheme("dark")} title="Dark mode">🌙</button>
            <button className={`${styles.ttBtn} ${theme === "light" ? styles.active : ""}`} onClick={() => setTheme("light")} title="Light mode">☀️</button>
          </div>

          {!loading && (
            <>
              {user ? (
                <div className={styles.userMenu} ref={dropdownRef}>
                  <div
                    className={styles.avatar}
                    title={user.displayName ?? user.email ?? ""}
                    onClick={() => setDropdownOpen(p => !p)}
                  >
                    {user.photoURL
                      ? <img src={user.photoURL} alt="avatar" className={styles.avatarImg} />
                      : initials}
                  </div>

                  {/* Dropdown */}
                  {dropdownOpen && (
                    <div className={styles.dropdown}>
                      <div className={styles.dropdownUser}>
                        <div className={styles.dropdownName}>{user.displayName ?? user.email?.split("@")[0]}</div>
                        <div className={styles.dropdownEmail}>{user.email}</div>
                      </div>
                      <div className={styles.dropdownDivider} />
                      <Link href="/profile" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                        🏅 My Profile
                      </Link>
                      <Link href="/settings" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                        ⚙️ Settings
                      </Link>
                      <div className={styles.dropdownDivider} />
                      <button className={`${styles.dropdownItem} ${styles.dropdownLogout}`} onClick={handleLogout}>
                        🚪 Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link href="/login" className={styles.loginLink}>Sign In</Link>
                  <Link href="/signup" className={styles.navCta}>Join Free</Link>
                </>
              )}
            </>
          )}

          {/* Hamburger */}
          <button className={styles.hamburger} onClick={() => setMenuOpen(p => !p)} aria-label="Menu">
            <span className={`${styles.hLine} ${menuOpen ? styles.hLine1Open : ""}`} />
            <span className={`${styles.hLine} ${menuOpen ? styles.hLine2Open : ""}`} />
            <span className={`${styles.hLine} ${menuOpen ? styles.hLine3Open : ""}`} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          <Link href="/about" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>About</Link>
          <Link href="/dashboard" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Dashboard</Link>
          <Link href="/subjects" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Subjects</Link>
          <Link href="/resources" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Resources</Link>
          <Link href="/leaderboard" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Leaderboard</Link>
          <Link href="/ask-ai" className={`${styles.mobileLink} ${styles.mobileLinkAi}`} onClick={() => setMenuOpen(false)}>Ask AI ✦</Link>
          <Link href="/feedback" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Feedback</Link>
          {user && <Link href="/profile" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>🏅 My Profile</Link>}
          {user && <Link href="/settings" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>⚙️ Settings</Link>}
          {user && <button className={`${styles.mobileLink} ${styles.mobileLinkLogout}`} onClick={handleLogout}>Sign Out</button>}
          {!user && <Link href="/login" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Sign In</Link>}
          {!user && <Link href="/signup" className={`${styles.mobileLink} ${styles.mobileLinkCta}`} onClick={() => setMenuOpen(false)}>Join Free</Link>}
        </div>
      )}
    </>
  );
}
