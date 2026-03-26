"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Navbar from "@/components/Navbar";
import styles from "./community.module.css";

const ALL_SUBJECTS = [
  { id: "english",          label: "English",          sub: "First Language English", icon: "📖" },
  { id: "maths",            label: "Mathematics",       sub: "Extended",               icon: "📐" },
  { id: "cs",               label: "Computer Science",  sub: "Core & Extended",        icon: "💻" },
  { id: "business",         label: "Business Studies",  sub: "Core & Supplement",      icon: "📊" },
  { id: "physics",          label: "Physics",           sub: "Core & Extended",        icon: "⚡" },
  { id: "chemistry",        label: "Chemistry",         sub: "Core & Extended",        icon: "🧪" },
];

interface Message {
  id: string;
  text: string;
  imageUrl?: string;
  uid: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp | null;
}

export default function CommunityPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<"loading" | "onboarding" | "chat">("loading");
  const [selected, setSelected] = useState<string[]>([]);
  const [joined, setJoined] = useState<string[]>([]);
  const [activeSubject, setActiveSubject] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Load user's joined subjects from Firestore
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().joinedSubjects?.length > 0) {
        const subs: string[] = snap.data().joinedSubjects;
        setJoined(subs);
        setActiveSubject(subs[0]);
        setStep("chat");
      } else {
        setStep("onboarding");
      }
    };
    load();
  }, [user]);

  // Real-time messages listener
  useEffect(() => {
    if (!activeSubject) return;
    const q = query(
      collection(db, "communities", activeSubject, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
    return unsub;
  }, [activeSubject]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Toggle subject selection during onboarding
  function toggleSubject(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  // Save joined subjects to Firestore
  async function handleJoin() {
    if (!user || selected.length === 0) return;
    await setDoc(doc(db, "users", user.uid), { joinedSubjects: selected }, { merge: true });
    setJoined(selected);
    setActiveSubject(selected[0]);
    setStep("chat");
  }

  // Handle image pick
  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Send message
  async function sendMessage() {
    if (!user || (!text.trim() && !imageFile) || sending) return;
    setSending(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const storageRef = ref(storage, `community/${activeSubject}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, "communities", activeSubject, "messages"), {
        text: text.trim(),
        imageUrl: imageUrl ?? null,
        uid: user.uid,
        displayName: user.displayName ?? user.email?.split("@")[0] ?? "Anonymous",
        photoURL: user.photoURL ?? null,
        createdAt: serverTimestamp(),
      });
      setText("");
      clearImage();
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(ts: Timestamp | null) {
    if (!ts) return "";
    const d = ts.toDate();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }

  const activeInfo = ALL_SUBJECTS.find((s) => s.id === activeSubject);

  if (loading || step === "loading") {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
      </div>
    );
  }

  // ── ONBOARDING ──────────────────────────────────────────────────────────────
  if (step === "onboarding") {
    return (
      <>
        <Navbar />
        <main className={styles.onboardingMain}>
          <div className={styles.onboardingCard}>
            <div className={styles.obBadge}>
              <span className={styles.pulseDot} /> Community
            </div>
            <h1>Which subjects do you want to join?</h1>
            <p>Select the communities you&apos;d like to be part of. You can always change this later.</p>

            <div className={styles.subjectGrid}>
              {ALL_SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  className={`${styles.subjectCard} ${selected.includes(s.id) ? styles.subjectSelected : ""}`}
                  onClick={() => toggleSubject(s.id)}
                >
                  <div className={styles.subjectIcon}>{s.icon}</div>
                  <div className={styles.subjectInfo}>
                    <div className={styles.subjectName}>c/{s.id}</div>
                    <div className={styles.subjectLabel}>{s.label}</div>
                    <div className={styles.subjectSub}>{s.sub}</div>
                  </div>
                  <div className={`${styles.checkmark} ${selected.includes(s.id) ? styles.checkmarkActive : ""}`}>
                    ✓
                  </div>
                </button>
              ))}
            </div>

            <button
              className={styles.joinBtn}
              onClick={handleJoin}
              disabled={selected.length === 0}
            >
              Join {selected.length > 0 ? `${selected.length} Community${selected.length > 1 ? "ies" : ""}` : "Communities"} →
            </button>
          </div>
        </main>
      </>
    );
  }

  // ── CHAT ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />
      <div className={styles.chatLayout}>

        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Communities</div>
          {joined.map((id) => {
            const s = ALL_SUBJECTS.find((x) => x.id === id);
            if (!s) return null;
            return (
              <button
                key={id}
                className={`${styles.sidebarItem} ${activeSubject === id ? styles.sidebarActive : ""}`}
                onClick={() => setActiveSubject(id)}
              >
                <span className={styles.sidebarIcon}>{s.icon}</span>
                <div className={styles.sidebarInfo}>
                  <div className={styles.sidebarCommunity}>c/{id}</div>
                  <div className={styles.sidebarSubject}>{s.label}</div>
                </div>
              </button>
            );
          })}
          <button className={styles.addMore} onClick={() => setStep("onboarding")}>
            + Join more
          </button>
        </aside>

        {/* CHAT AREA */}
        <div className={styles.chatArea}>

          {/* Chat Header */}
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderIcon}>{activeInfo?.icon}</div>
            <div>
              <div className={styles.chatHeaderTitle}>c/{activeSubject}</div>
              <div className={styles.chatHeaderSub}>{activeInfo?.label} · {activeInfo?.sub}</div>
            </div>
          </div>

          {/* Messages */}
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.emptyChat}>
                <div className={styles.emptyChatIcon}>{activeInfo?.icon}</div>
                <div className={styles.emptyChatTitle}>No messages yet</div>
                <div className={styles.emptyChatSub}>Be the first to start the conversation in c/{activeSubject}!</div>
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.uid === user?.uid;
              return (
                <div key={msg.id} className={`${styles.msgRow} ${isMe ? styles.msgMe : styles.msgThem}`}>
                  {!isMe && (
                    <div className={styles.msgAvatar}>
                      {msg.photoURL
                        ? <img src={msg.photoURL} alt={msg.displayName} className={styles.msgAvatarImg} />
                        : <span>{getInitials(msg.displayName)}</span>
                      }
                    </div>
                  )}
                  <div className={styles.msgBubbleWrap}>
                    {!isMe && <div className={styles.msgName}>{msg.displayName}</div>}
                    <div className={`${styles.msgBubble} ${isMe ? styles.bubbleMe : styles.bubbleThem}`}>
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="shared"
                          className={styles.msgImage}
                          onClick={() => window.open(msg.imageUrl, "_blank")}
                        />
                      )}
                      {msg.text && <span>{msg.text}</span>}
                    </div>
                    <div className={`${styles.msgTime} ${isMe ? styles.timeMe : ""}`}>
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Image preview */}
          {imagePreview && (
            <div className={styles.imagePreviewBar}>
              <img src={imagePreview} alt="preview" className={styles.imagePreviewThumb} />
              <span className={styles.imagePreviewName}>{imageFile?.name}</span>
              <button className={styles.imagePreviewRemove} onClick={clearImage}>✕</button>
            </div>
          )}

          {/* Input */}
          <div className={styles.inputBar}>
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={handleImagePick}
              className={styles.hiddenFileInput}
            />
            <button
              className={styles.attachBtn}
              onClick={() => fileRef.current?.click()}
              title="Attach image"
            >
              📎
            </button>
            <textarea
              className={styles.textInput}
              placeholder={`Message c/${activeSubject}...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              className={styles.sendBtn}
              onClick={sendMessage}
              disabled={sending || (!text.trim() && !imageFile)}
            >
              {sending ? "..." : "↑"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
                  }
