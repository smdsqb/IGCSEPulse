"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, collection, query, orderBy,
  onSnapshot, addDoc, deleteDoc, serverTimestamp, Timestamp,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Navbar from "@/components/Navbar";
import styles from "./community.module.css";

const ALL_SUBJECTS = [
  { id: "english",  label: "English",         sub: "First Language English", icon: "📖" },
  { id: "maths",    label: "Mathematics",      sub: "Extended",               icon: "📐" },
  { id: "cs",       label: "Computer Science", sub: "Core & Extended",        icon: "💻" },
  { id: "business", label: "Business Studies", sub: "Core & Supplement",      icon: "📊" },
  { id: "physics",  label: "Physics",          sub: "Core & Extended",        icon: "⚡" },
  { id: "chemistry",label: "Chemistry",        sub: "Core & Extended",        icon: "🧪" },
];

const EMOJIS = ["😀","😂","😍","🔥","👍","💀","🤔","😭","🙏","💯","🎉","😎","👀","💪","🤯","📚","✅","❓","⚡","🧠"];

interface Message {
  id: string;
  text: string;
  imageUrl?: string | null;
  uid: string;
  displayName: string;
  photoURL?: string | null;
  createdAt: Timestamp | null;
}

interface TypingUser { displayName: string; }

export default function CommunityPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [step, setStep]                   = useState<"loading"|"onboarding"|"chat">("loading");
  const [selected, setSelected]           = useState<string[]>([]);
  const [joined, setJoined]               = useState<string[]>([]);
  const [activeSubject, setActiveSubject] = useState("");
  const [messages, setMessages]           = useState<Message[]>([]);
  const [text, setText]                   = useState("");
  const [sending, setSending]             = useState(false);
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [lightbox, setLightbox]           = useState<string | null>(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [showSearch, setShowSearch]       = useState(false);
  const [showEmoji, setShowEmoji]         = useState(false);
  const [typingUsers, setTypingUsers]     = useState<TypingUser[]>([]);
  const [onlineCount, setOnlineCount]     = useState(0);
  const [unread, setUnread]               = useState<Record<string, number>>({});
  const [lastSeen, setLastSeen]           = useState<Record<string, number>>({});

  const bottomRef    = useRef<HTMLDivElement>(null);
  const fileRef      = useRef<HTMLInputElement>(null);
  const typingTimer  = useRef<NodeJS.Timeout | null>(null);
  const prevSubject  = useRef("");

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Load joined subjects
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data().joinedSubjects?.length > 0) {
        const subs: string[] = snap.data().joinedSubjects;
        const seen: Record<string, number> = snap.data().lastSeen ?? {};
        setJoined(subs);
        setLastSeen(seen);
        setActiveSubject(subs[0]);
        setStep("chat");
      } else {
        setStep("onboarding");
      }
    });
  }, [user]);

  // Messages listener
  useEffect(() => {
    if (!activeSubject) return;
    const q = query(collection(db, "communities", activeSubject, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      // unread badge: count messages after lastSeen for other subjects
      if (prevSubject.current && prevSubject.current !== activeSubject) {
        const seenAt = lastSeen[prevSubject.current] ?? 0;
        const count = msgs.filter(m => m.createdAt && m.createdAt.toMillis() > seenAt && m.uid !== user?.uid).length;
        setUnread(prev => ({ ...prev, [prevSubject.current]: count }));
      }
    });
    prevSubject.current = activeSubject;
    return unsub;
  }, [activeSubject, user?.uid, lastSeen]);

  // Typing listeners
  useEffect(() => {
    if (!activeSubject || !user) return;
    const q = query(collection(db, "communities", activeSubject, "typing"), where("uid", "!=", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      setTypingUsers(
        snap.docs
          .map(d => d.data() as TypingUser & { updatedAt: number })
          .filter(d => now - (d.updatedAt ?? 0) < 5000)
      );
    });
    return unsub;
  }, [activeSubject, user]);

  // Online presence
  useEffect(() => {
    if (!activeSubject || !user) return;
    const presenceRef = doc(db, "communities", activeSubject, "presence", user.uid);
    setDoc(presenceRef, { uid: user.uid, online: true, updatedAt: Date.now() });
    const q = query(collection(db, "communities", activeSubject, "presence"), where("online", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      setOnlineCount(snap.docs.filter(d => now - (d.data().updatedAt ?? 0) < 30000).length);
    });
    return () => {
      setDoc(presenceRef, { uid: user.uid, online: false, updatedAt: Date.now() });
      unsub();
    };
  }, [activeSubject, user]);

  // Mark as seen when switching subject
  function switchSubject(id: string) {
    if (!user) return;
    const now = Date.now();
    setLastSeen(prev => ({ ...prev, [id]: now }));
    setUnread(prev => ({ ...prev, [id]: 0 }));
    setDoc(doc(db, "users", user.uid), { lastSeen: { [id]: now } }, { merge: true });
    setActiveSubject(id);
    setShowSearch(false);
    setSearchQuery("");
  }

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Typing indicator
  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!user || !activeSubject) return;
    const tRef = doc(db, "communities", activeSubject, "typing", user.uid);
    if (isTyping) {
      await setDoc(tRef, { uid: user.uid, displayName: user.displayName ?? "Someone", updatedAt: Date.now() });
    } else {
      await deleteDoc(tRef).catch(() => {});
    }
  }, [user, activeSubject]);

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 3000);
  }

  function toggleSubject(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  async function handleJoin() {
    if (!user || selected.length === 0) return;
    const merged = Array.from(new Set([...joined, ...selected]));
    await setDoc(doc(db, "users", user.uid), { joinedSubjects: merged }, { merge: true });
    setJoined(merged);
    setActiveSubject(selected[0]);
    setSelected([]);
    setStep("chat");
  }

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

  async function sendMessage() {
    if (!user || (!text.trim() && !imageFile) || sending) return;
    setSending(true);
    setTyping(false);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const storageRef = ref(storage, `community/${activeSubject}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, "communities", activeSubject, "messages"), {
        text: text.trim(),
        imageUrl,
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

  async function deleteMessage(msgId: string) {
    await deleteDoc(doc(db, "communities", activeSubject, "messages", msgId));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function formatTime(ts: Timestamp | null) {
    if (!ts) return "";
    return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  }

  const activeInfo = ALL_SUBJECTS.find(s => s.id === activeSubject);
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()) || m.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (loading || step === "loading") return (
    <div className={styles.loadingScreen}><div className={styles.spinner} /></div>
  );

  // ── ONBOARDING ──────────────────────────────────────────────────────────────
  if (step === "onboarding") return (
    <>
      <Navbar />
      <main className={styles.onboardingMain}>
        <div className={styles.onboardingCard}>
          <div className={styles.obBadge}><span className={styles.pulseDot} /> Community</div>
          <h1>{joined.length > 0 ? "Join more communities" : "Which subjects do you want to join?"}</h1>
          <p>{joined.length > 0 ? "Pick more subjects to add to your sidebar." : "Select the communities you'd like to be part of. You can always change this later."}</p>
          <div className={styles.subjectGrid}>
            {ALL_SUBJECTS.filter(s => !joined.includes(s.id)).map((s) => (
              <button key={s.id} className={`${styles.subjectCard} ${selected.includes(s.id) ? styles.subjectSelected : ""}`} onClick={() => toggleSubject(s.id)}>
                <div className={styles.subjectIcon}>{s.icon}</div>
                <div className={styles.subjectInfo}>
                  <div className={styles.subjectName}>c/{s.id}</div>
                  <div className={styles.subjectLabel}>{s.label}</div>
                  <div className={styles.subjectSub}>{s.sub}</div>
                </div>
                <div className={`${styles.checkmark} ${selected.includes(s.id) ? styles.checkmarkActive : ""}`}>✓</div>
              </button>
            ))}
            {ALL_SUBJECTS.filter(s => !joined.includes(s.id)).length === 0 && (
              <p className={styles.allJoined}>You&apos;ve joined all subjects! 🎉</p>
            )}
          </div>
          <div className={styles.onboardingBtns}>
            {joined.length > 0 && <button className={styles.cancelBtn} onClick={() => setStep("chat")}>Cancel</button>}
            <button className={styles.joinBtn} onClick={handleJoin} disabled={selected.length === 0}>
              Join {selected.length > 0 ? `${selected.length} Community${selected.length > 1 ? "ies" : ""}` : "Communities"} →
            </button>
          </div>
        </div>
      </main>
    </>
  );

  // ── CHAT ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />
      {/* Lightbox */}
      {lightbox && (
        <div className={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="full size" className={styles.lightboxImg} onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div className={styles.chatLayout}>
        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Communities</div>
          {joined.map((id) => {
            const s = ALL_SUBJECTS.find(x => x.id === id);
            if (!s) return null;
            return (
              <button key={id} className={`${styles.sidebarItem} ${activeSubject === id ? styles.sidebarActive : ""}`} onClick={() => switchSubject(id)}>
                <span className={styles.sidebarIcon}>{s.icon}</span>
                <div className={styles.sidebarInfo}>
                  <div className={styles.sidebarCommunity}>c/{id}</div>
                  <div className={styles.sidebarSubject}>{s.label}</div>
                </div>
                {unread[id] > 0 && activeSubject !== id && (
                  <span className={styles.unreadBadge}>{unread[id] > 99 ? "99+" : unread[id]}</span>
                )}
              </button>
            );
          })}
          <button className={styles.addMore} onClick={() => setStep("onboarding")}>+ Join more</button>
        </aside>

        {/* CHAT AREA */}
        <div className={styles.chatArea}>
          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderIcon}>{activeInfo?.icon}</div>
            <div className={styles.chatHeaderText}>
              <div className={styles.chatHeaderTitle}>c/{activeSubject}</div>
              <div className={styles.chatHeaderSub}>
                {activeInfo?.label} · {activeInfo?.sub}
                <span className={styles.onlineDot} />
                <span className={styles.onlineCount}>{onlineCount} online</span>
              </div>
            </div>
            <button className={`${styles.searchToggle} ${showSearch ? styles.searchToggleActive : ""}`} onClick={() => { setShowSearch(p => !p); setSearchQuery(""); }} title="Search">🔍</button>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div className={styles.searchBar}>
              <input
                autoFocus
                className={styles.searchInput}
                placeholder="Search messages..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && <span className={styles.searchCount}>{filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""}</span>}
            </div>
          )}

          {/* Messages */}
          <div className={styles.messages}>
            {filteredMessages.length === 0 && !searchQuery && (
              <div className={styles.emptyChat}>
                <div className={styles.emptyChatIcon}>{activeInfo?.icon}</div>
                <div className={styles.emptyChatTitle}>No messages yet</div>
                <div className={styles.emptyChatSub}>Be the first to start the conversation in c/{activeSubject}!</div>
              </div>
            )}
            {filteredMessages.length === 0 && searchQuery && (
              <div className={styles.emptyChat}>
                <div className={styles.emptyChatTitle}>No results for &quot;{searchQuery}&quot;</div>
              </div>
            )}
            {filteredMessages.map((msg) => {
              const isMe = msg.uid === user?.uid;
              return (
                <div key={msg.id} className={`${styles.msgRow} ${isMe ? styles.msgMe : styles.msgThem}`}>
                  {!isMe && (
                    <div className={styles.msgAvatar}>
                      {msg.photoURL
                        ? <img src={msg.photoURL} alt={msg.displayName} className={styles.msgAvatarImg} />
                        : <span>{getInitials(msg.displayName)}</span>}
                    </div>
                  )}
                  <div className={styles.msgBubbleWrap}>
                    {!isMe && <div className={styles.msgName}>{msg.displayName}</div>}
                    <div className={`${styles.msgBubble} ${isMe ? styles.bubbleMe : styles.bubbleThem}`}>
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="shared" className={styles.msgImage} onClick={() => setLightbox(msg.imageUrl!)} />
                      )}
                      {msg.text && <span>{msg.text}</span>}
                    </div>
                    <div className={`${styles.msgMeta} ${isMe ? styles.metaMe : ""}`}>
                      <span className={styles.msgTime}>{formatTime(msg.createdAt)}</span>
                      {isMe && <button className={styles.deleteBtn} onClick={() => deleteMessage(msg.id)} title="Delete">✕</button>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className={styles.typingIndicator}>
              <div className={styles.typingDots}><span /><span /><span /></div>
              <span>{typingUsers.map(t => t.displayName).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...</span>
            </div>
          )}

          {/* Image preview */}
          {imagePreview && (
            <div className={styles.imagePreviewBar}>
              <img src={imagePreview} alt="preview" className={styles.imagePreviewThumb} />
              <span className={styles.imagePreviewName}>{imageFile?.name}</span>
              <button className={styles.imagePreviewRemove} onClick={clearImage}>✕</button>
            </div>
          )}

          {/* Emoji picker */}
          {showEmoji && (
            <div className={styles.emojiPicker}>
              {EMOJIS.map(e => (
                <button key={e} className={styles.emojiBtn} onClick={() => { setText(t => t + e); setShowEmoji(false); }}>{e}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className={styles.inputBar}>
            <input type="file" accept="image/*" ref={fileRef} onChange={handleImagePick} className={styles.hiddenFileInput} />
            <button className={styles.attachBtn} onClick={() => fileRef.current?.click()} title="Attach image">📎</button>
            <button className={`${styles.attachBtn} ${showEmoji ? styles.attachActive : ""}`} onClick={() => setShowEmoji(p => !p)} title="Emoji">😊</button>
            <textarea
              className={styles.textInput}
              placeholder={`Message c/${activeSubject}...`}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button className={styles.sendBtn} onClick={sendMessage} disabled={sending || (!text.trim() && !imageFile)}>
              {sending ? "..." : "↑"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
