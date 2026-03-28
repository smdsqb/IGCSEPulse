"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { db, storage, auth } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, deleteDoc, collection,
  getDocs, updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  updateProfile, updateEmail, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider,
  deleteUser, GoogleAuthProvider, reauthenticateWithPopup,
} from "firebase/auth";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import styles from "./settings.module.css";

const SUBJECTS = [
  { id: "english",         name: "English",          icon: "📖" },
  { id: "maths",           name: "Mathematics",       icon: "📐" },
  { id: "cs",              name: "Computer Science",  icon: "💻" },
  { id: "business",        name: "Business Studies",  icon: "📊" },
  { id: "physics",         name: "Physics",           icon: "⚡" },
  { id: "chemistry",       name: "Chemistry",         icon: "🧪" },
];

type Tab = "profile" | "account" | "notifications" | "appearance" | "communities" | "danger";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [tab, setTab]                         = useState<Tab>("profile");
  const [displayName, setDisplayName]         = useState("");
  const [avatarFile, setAvatarFile]           = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview]     = useState<string | null>(null);
  const [newEmail, setNewEmail]               = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [notifSettings, setNotifSettings]     = useState({ newReplies: true, announcements: true, aiUpdates: true });
  const [saving, setSaving]                   = useState(false);
  const [msg, setMsg]                         = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm]     = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? "");
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setJoinedCommunities(data.joinedSubjects ?? []);
        if (data.notifications) setNotifSettings(data.notifications);
      }
    });
  }, [user]);

  function showMsg(type: "success" | "error", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  // ── Save profile ────────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      let photoURL = user.photoURL ?? undefined;
      if (avatarFile) {
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(storageRef, avatarFile);
        photoURL = await getDownloadURL(storageRef);
      }
      await updateProfile(user, {
        displayName: displayName.trim() || user.displayName,
        photoURL: photoURL ?? null,
      });
      await setDoc(doc(db, "users", user.uid), { displayName: displayName.trim() }, { merge: true });
      showMsg("success", "Profile updated!");
      setAvatarFile(null);
    } catch (err: unknown) {
      showMsg("error", (err as Error).message ?? "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  // ── Save email ──────────────────────────────────────────────────────────────
  async function saveEmail() {
    if (!user || !newEmail || !currentPassword) return;
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, newEmail);
      showMsg("success", "Email updated!");
      setNewEmail("");
      setCurrentPassword("");
    } catch (err: unknown) {
      showMsg("error", (err as Error).message ?? "Failed to update email.");
    } finally {
      setSaving(false);
    }
  }

  // ── Save password ───────────────────────────────────────────────────────────
  async function savePassword() {
    if (!user || !currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) return showMsg("error", "Passwords don't match.");
    if (newPassword.length < 6) return showMsg("error", "Password must be at least 6 characters.");
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      showMsg("success", "Password updated!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      showMsg("error", (err as Error).message ?? "Failed to update password.");
    } finally {
      setSaving(false);
    }
  }

  // ── Save notifications ──────────────────────────────────────────────────────
  async function saveNotifications() {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), { notifications: notifSettings }, { merge: true });
      showMsg("success", "Notification preferences saved!");
    } catch {
      showMsg("error", "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  // ── Leave community ─────────────────────────────────────────────────────────
  async function leaveCommunity(subjectId: string) {
    if (!user) return;
    const updated = joinedCommunities.filter((s) => s !== subjectId);
    await setDoc(doc(db, "users", user.uid), { joinedSubjects: updated }, { merge: true });
    setJoinedCommunities(updated);
    showMsg("success", `Left c/${subjectId}`);
  }

  // ── Delete account ──────────────────────────────────────────────────────────
  async function deleteAccount() {
    if (!user || deleteConfirm !== "DELETE") return;
    setSaving(true);
    try {
      // Try Google re-auth first, fallback to email
      const isGoogle = user.providerData.some((p) => p.providerId === "google.com");
      if (isGoogle) {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      } else if (currentPassword) {
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }
      // Delete user Firestore data
      await deleteDoc(doc(db, "users", user.uid));
      // Delete the Firebase Auth account
      await deleteUser(user);
      router.push("/");
    } catch (err: unknown) {
      showMsg("error", (err as Error).message ?? "Failed to delete account.");
    } finally {
      setSaving(false);
    }
  }

  const isGoogleUser = user?.providerData.some((p) => p.providerId === "google.com");

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "profile",       label: "Profile",        icon: "👤" },
    { id: "account",       label: "Account",         icon: "🔐" },
    { id: "notifications", label: "Notifications",   icon: "🔔" },
    { id: "appearance",    label: "Appearance",      icon: "🎨" },
    { id: "communities",   label: "Communities",     icon: "💬" },
    { id: "danger",        label: "Danger Zone",     icon: "⚠️" },
  ];

  if (loading || !user) return (
    <div className={styles.loadingScreen}><div className={styles.spinner} /></div>
  );

  return (
    <>
      <Navbar />
      <div className={styles.page}>
        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Settings</div>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`${styles.tabBtn} ${tab === t.id ? styles.tabActive : ""} ${t.id === "danger" ? styles.tabDanger : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </aside>

        {/* MAIN */}
        <main className={styles.main}>
          {/* Toast */}
          {msg && (
            <div className={`${styles.toast} ${msg.type === "success" ? styles.toastSuccess : styles.toastError}`}>
              {msg.type === "success" ? "✓" : "✕"} {msg.text}
            </div>
          )}

          {/* ── PROFILE ── */}
          {tab === "profile" && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Profile</div>
              <div className={styles.sectionSub}>How you appear to other students on IGCSEPulse.</div>

              {/* Avatar */}
              <div className={styles.avatarSection}>
                <div className={styles.avatarBig} onClick={() => avatarRef.current?.click()}>
                  {(avatarPreview || user.photoURL) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview ?? user.photoURL!} alt="avatar" />
                  ) : (
                    <span>{user.displayName?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}</span>
                  )}
                  <div className={styles.avatarOverlay}>📷</div>
                </div>
                <input ref={avatarRef} type="file" accept="image/*" className={styles.hidden} onChange={handleAvatarChange} />
                <div>
                  <div className={styles.avatarName}>{user.displayName ?? user.email}</div>
                  <div className={styles.avatarHint}>Click avatar to change photo</div>
                </div>
              </div>

              <div className={styles.field}>
                <label>Display Name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>

              <div className={styles.field}>
                <label>Email</label>
                <input type="email" value={user.email ?? ""} disabled className={styles.disabledInput} />
                <span className={styles.fieldHint}>Change email in the Account tab</span>
              </div>

              <button className={styles.saveBtn} onClick={saveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {tab === "account" && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Account</div>
              <div className={styles.sectionSub}>Manage your login credentials.</div>

              {isGoogleUser ? (
                <div className={styles.infoCard}>
                  <span>🔗</span>
                  <div>
                    <div className={styles.infoCardTitle}>Signed in with Google</div>
                    <div className={styles.infoCardSub}>Your account uses Google Sign-In. Email and password changes are managed through your Google account.</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.subSection}>
                    <div className={styles.subSectionTitle}>Change Email</div>
                    <div className={styles.field}>
                      <label>New Email</label>
                      <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" />
                    </div>
                    <div className={styles.field}>
                      <label>Current Password</label>
                      <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                    <button className={styles.saveBtn} onClick={saveEmail} disabled={saving || !newEmail || !currentPassword}>
                      {saving ? "Saving..." : "Update Email"}
                    </button>
                  </div>

                  <div className={styles.divider} />

                  <div className={styles.subSection}>
                    <div className={styles.subSectionTitle}>Change Password</div>
                    <div className={styles.field}>
                      <label>Current Password</label>
                      <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                    <div className={styles.field}>
                      <label>New Password</label>
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
                    </div>
                    <div className={styles.field}>
                      <label>Confirm New Password</label>
                      <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                    <button className={styles.saveBtn} onClick={savePassword} disabled={saving || !currentPassword || !newPassword}>
                      {saving ? "Saving..." : "Update Password"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab === "notifications" && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Notifications</div>
              <div className={styles.sectionSub}>Choose what you want to be notified about.</div>

              {[
                { key: "newReplies",    label: "New replies to your posts",       sub: "Get notified when someone replies to your community posts" },
                { key: "announcements", label: "Platform announcements",           sub: "Important updates about IGCSEPulse features and changes" },
                { key: "aiUpdates",     label: "AI tutor updates",                sub: "When new subjects or features are added to Ask AI" },
              ].map((item) => (
                <div key={item.key} className={styles.toggleRow}>
                  <div>
                    <div className={styles.toggleLabel}>{item.label}</div>
                    <div className={styles.toggleSub}>{item.sub}</div>
                  </div>
                  <button
                    className={`${styles.toggle} ${notifSettings[item.key as keyof typeof notifSettings] ? styles.toggleOn : ""}`}
                    onClick={() => setNotifSettings((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof typeof notifSettings] }))}
                  >
                    <span className={styles.toggleKnob} />
                  </button>
                </div>
              ))}

              <button className={styles.saveBtn} onClick={saveNotifications} disabled={saving}>
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {tab === "appearance" && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Appearance</div>
              <div className={styles.sectionSub}>Customise how IGCSEPulse looks for you.</div>

              <div className={styles.themeCards}>
                <button
                  className={`${styles.themeCard} ${theme === "dark" ? styles.themeCardActive : ""}`}
                  onClick={() => setTheme("dark")}
                >
                  <div className={styles.themePreview} data-theme-preview="dark">
                    <div className={styles.tpNav} />
                    <div className={styles.tpContent}><div /><div /><div /></div>
                  </div>
                  <div className={styles.themeCardLabel}>🌙 Dark</div>
                  {theme === "dark" && <div className={styles.themeCardCheck}>✓</div>}
                </button>
                <button
                  className={`${styles.themeCard} ${theme === "light" ? styles.themeCardActive : ""}`}
                  onClick={() => setTheme("light")}
                >
                  <div className={styles.themePreview} data-theme-preview="light">
                    <div className={styles.tpNav} />
                    <div className={styles.tpContent}><div /><div /><div /></div>
                  </div>
                  <div className={styles.themeCardLabel}>☀️ Light</div>
                  {theme === "light" && <div className={styles.themeCardCheck}>✓</div>}
                </button>
              </div>
            </div>
          )}

          {/* ── COMMUNITIES ── */}
          {tab === "communities" && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Communities</div>
              <div className={styles.sectionSub}>Manage which subject communities you&apos;re part of.</div>

              {joinedCommunities.length === 0 ? (
                <div className={styles.emptyState}>
                  <div>You haven&apos;t joined any communities yet.</div>
                  <Link href="/community" className={styles.saveBtn} style={{ display: "inline-block", marginTop: "12px" }}>
                    Browse Communities
                  </Link>
                </div>
              ) : (
                <div className={styles.communityList}>
                  {joinedCommunities.map((id) => {
                    const s = SUBJECTS.find((x) => x.id === id);
                    return (
                      <div key={id} className={styles.communityRow}>
                        <div className={styles.communityIcon}>{s?.icon ?? "💬"}</div>
                        <div className={styles.communityInfo}>
                          <div className={styles.communityName}>{s?.name ?? id}</div>
                          <div className={styles.communitySub}>c/{id}</div>
                        </div>
                        <button className={styles.leaveBtn} onClick={() => leaveCommunity(id)}>Leave</button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className={styles.divider} />
              <div className={styles.subSectionTitle}>Join more communities</div>
              <div className={styles.communityList}>
                {SUBJECTS.filter((s) => !joinedCommunities.includes(s.id)).map((s) => (
                  <div key={s.id} className={styles.communityRow}>
                    <div className={styles.communityIcon}>{s.icon}</div>
                    <div className={styles.communityInfo}>
                      <div className={styles.communityName}>{s.name}</div>
                      <div className={styles.communitySub}>c/{s.id}</div>
                    </div>
                    <button className={styles.joinBtn} onClick={async () => {
                      if (!user) return;
                      const updated = [...joinedCommunities, s.id];
                      await setDoc(doc(db, "users", user.uid), { joinedSubjects: updated }, { merge: true });
                      setJoinedCommunities(updated);
                      showMsg("success", `Joined c/${s.id}!`);
                    }}>Join</button>
                  </div>
                ))}
                {SUBJECTS.every((s) => joinedCommunities.includes(s.id)) && (
                  <div className={styles.allJoined}>You&apos;ve joined all communities! 🎉</div>
                )}
              </div>
            </div>
          )}

          {/* ── DANGER ZONE ── */}
          {tab === "danger" && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Danger Zone</div>
              <div className={styles.sectionSub}>These actions are permanent and cannot be undone.</div>

              <div className={styles.dangerCard}>
                <div className={styles.dangerCardLeft}>
                  <div className={styles.dangerCardTitle}>Delete Account</div>
                  <div className={styles.dangerCardSub}>Permanently delete your account, all your messages, and chat history. This cannot be reversed.</div>
                </div>
                <button className={styles.dangerBtn} onClick={() => setShowDeleteModal(true)}>Delete Account</button>
              </div>

              {showDeleteModal && (
                <div className={styles.modalOverlay} onClick={() => setShowDeleteModal(false)}>
                  <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.modalTitle}>⚠️ Delete Account</div>
                    <div className={styles.modalSub}>This will permanently delete your account and all your data. Type <strong>DELETE</strong> to confirm.</div>
                    {!isGoogleUser && (
                      <div className={styles.field}>
                        <label>Current Password</label>
                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
                      </div>
                    )}
                    <div className={styles.field}>
                      <label>Type DELETE to confirm</label>
                      <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
                    </div>
                    <div className={styles.modalBtns}>
                      <button className={styles.cancelBtn} onClick={() => setShowDeleteModal(false)}>Cancel</button>
                      <button className={styles.dangerBtn} onClick={deleteAccount} disabled={deleteConfirm !== "DELETE" || saving}>
                        {saving ? "Deleting..." : "Delete Forever"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.aboutCard}>
                <div className={styles.aboutLogo}>IGCSE<span>Pulse</span></div>
                <div className={styles.aboutVersion}>Version 1.0.0</div>
                <div className={styles.aboutSub}>Built by students, for students. Powered by Groq AI · Cambridge IGCSE syllabus.</div>
                <div className={styles.aboutLinks}>
                  <a href="/subjects">Subjects</a>
                  <a href="/resources">Resources</a>
                  <a href="/community">Community</a>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
