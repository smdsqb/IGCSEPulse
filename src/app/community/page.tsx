"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, collection, query, orderBy,
  onSnapshot, addDoc, deleteDoc, serverTimestamp, Timestamp,
  where, updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Navbar from "@/components/Navbar";
import styles from "./community.module.css";

const ALL_SUBJECTS = [
  { id: "english",   label: "English",         sub: "First Language English", icon: "📖" },
  { id: "maths",     label: "Mathematics",      sub: "Extended",               icon: "📐" },
  { id: "cs",        label: "Computer Science", sub: "Core & Extended",        icon: "💻" },
  { id: "business",  label: "Business Studies", sub: "Core & Supplement",      icon: "📊" },
  { id: "physics",   label: "Physics",          sub: "Core & Extended",        icon: "⚡" },
  { id: "chemistry", label: "Chemistry",        sub: "Core & Extended",        icon: "🧪" },
];

const QUICK_EMOJIS = ["👍","❤️","😂","😮","😢","🔥"];
const ALL_EMOJIS   = ["😀","😂","😍","🔥","👍","💀","🤔","😭","🙏","💯","🎉","😎","👀","💪","🤯","📚","✅","❓","⚡","🧠","❤️","😮","😢","🥳","👏","🫡","💡","🤝","😅","🙌"];

interface Reaction { emoji: string; uid: string; }

interface Message {
  id: string;
  text: string;
  imageUrl?: string | null;
  uid: string;
  displayName: string;
  photoURL?: string | null;
  createdAt: Timestamp | null;
  isAI?: boolean;
  replyTo?: {
    id: string;
    text: string;
    displayName: string;
  } | null;
  reactions?: Record<string, string[]>; // emoji -> uid[]
}

interface TypingUser { displayName: string; updatedAt: number; }

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ── AI mention detection ──────────────────────────────────────────────────────
function containsAIMention(text: string) {
  return /@AI\b/i.test(text);
}

function stripAIMention(text: string) {
  return text.replace(/@AI\b/gi, "").trim();
}

// ── Component ─────────────────────────────────────────────────────────────────
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
  const [replyTo, setReplyTo]             = useState<Message | null>(null);
  const [aiLoading, setAiLoading]         = useState(false);

  // Emoji reaction state
  const [quickEmojiFor, setQuickEmojiFor]   = useState<string | null>(null); // msgId showing quick bar
  const [fullEmojiFor, setFullEmojiFor]     = useState<string | null>(null);  // msgId showing full picker
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // @AI mention dropdown
  const [showAiMention, setShowAiMention] = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const prevSubject = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

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

  useEffect(() => {
    if (!activeSubject) return;
    const q = query(collection(db, "communities", activeSubject, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      if (prevSubject.current && prevSubject.current !== activeSubject) {
        const seenAt = lastSeen[prevSubject.current] ?? 0;
        const count = msgs.filter(m => m.createdAt && m.createdAt.toMillis() > seenAt && m.uid !== user?.uid).length;
        setUnread(prev => ({ ...prev, [prevSubject.current]: count }));
      }
    });
    prevSubject.current = activeSubject;
    return unsub;
  }, [activeSubject, user?.uid, lastSeen]);

  useEffect(() => {
    if (!activeSubject || !user) return;
    const q = query(collection(db, "communities", activeSubject, "typing"), where("uid", "!=", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      setTypingUsers(
        snap.docs.map(d => d.data() as TypingUser).filter(d => now - (d.updatedAt ?? 0) < 5000)
      );
    });
    return unsub;
  }, [activeSubject, user]);

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

  function switchSubject(id: string) {
    if (!user) return;
    const now = Date.now();
    setLastSeen(prev => ({ ...prev, [id]: now }));
    setUnread(prev => ({ ...prev, [id]: 0 }));
    setDoc(doc(db, "users", user.uid), { lastSeen: { [id]: now } }, { merge: true });
    setActiveSubject(id);
    setShowSearch(false);
    setSearchQuery("");
    setReplyTo(null);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    const val = e.target.value;
    setText(val);
    // Show @AI dropdown when user is actively typing @ or @A or @AI
    const atMatch = /(?:^|[\s])@(AI?)?$/i.test(val);
    setShowAiMention(atMatch);
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 3000);
  }

  function insertAIMention() {
    const newText = text.endsWith("@") ? text + "AI " : text + "@AI ";
    setText(newText);
    setShowAiMention(false);
    textareaRef.current?.focus();
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

  // ── Send AI reply in chat ──────────────────────────────────────────────────
  async function sendAIReply(question: string) {
    if (!user) return;
    setAiLoading(true);
    try {
      const subjectId = ALL_SUBJECTS.find(s => s.id === activeSubject)?.label ?? activeSubject;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          subject: activeSubject === "maths" ? "math" : activeSubject === "cs" ? "computer-science" : activeSubject,
          marks: null,
          userId: user.uid,
          sessionId: "community",
          history: [],
        }),
      });
      const data = await res.json();
      const answer = (data.reply ?? "Sorry, I couldn't answer that.")
        .replace(/CONFIDENCE:.*$/im, "")
        .replace(/RELATED_PP:.*$/im, "")
        .replace(/SUGGESTIONS:.*$/im, "")
        .trim();

      await addDoc(collection(db, "communities", activeSubject, "messages"), {
        text: `🤖 **AI Answer**\n${answer}`,
        imageUrl: null,
        uid: "AI_BOT",
        displayName: "IGCSePulse AI",
        photoURL: null,
        isAI: true,
        createdAt: serverTimestamp(),
      });
    } catch {
      await addDoc(collection(db, "communities", activeSubject, "messages"), {
        text: "🤖 Sorry, I couldn't answer that right now.",
        uid: "AI_BOT",
        displayName: "IGCSePulse AI",
        isAI: true,
        createdAt: serverTimestamp(),
      });
    } finally {
      setAiLoading(false);
    }
  }

  async function sendMessage() {
    if (!user || (!text.trim() && !imageFile) || sending) return;
    const msgText = text.trim();
    setSending(true);
    setTyping(false);
    setShowAiMention(false);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const storageRef = ref(storage, `community/${activeSubject}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, "communities", activeSubject, "messages"), {
        text: msgText,
        imageUrl,
        uid: user.uid,
        displayName: user.displayName ?? user.email?.split("@")[0] ?? "Anonymous",
        photoURL: user.photoURL ?? null,
        isAI: false,
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text?.slice(0, 80) ?? "", displayName: replyTo.displayName } : null,
        reactions: {},
        createdAt: serverTimestamp(),
      });
      setText("");
      clearImage();
      setReplyTo(null);

      // Trigger AI if mentioned
      if (containsAIMention(msgText)) {
        const q = stripAIMention(msgText);
        if (q.length > 0) await sendAIReply(q);
      }
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(msgId: string) {
    await deleteDoc(doc(db, "communities", activeSubject, "messages", msgId));
  }

  // ── Emoji reactions ───────────────────────────────────────────────────────
  async function toggleReaction(msgId: string, emoji: string) {
    if (!user) return;
    const msgRef = doc(db, "communities", activeSubject, "messages", msgId);
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const current = msg.reactions?.[emoji] ?? [];
    const hasReacted = current.includes(user.uid);
    const updated = hasReacted ? current.filter(u => u !== user.uid) : [...current, user.uid];
    await updateDoc(msgRef, { [`reactions.${emoji}`]: updated });
    setQuickEmojiFor(null);
    setFullEmojiFor(null);
  }

  // Hold to show full picker
  function handleMsgPointerDown(msgId: string) {
    holdTimerRef.current = setTimeout(() => {
      setFullEmojiFor(msgId);
      setQuickEmojiFor(null);
    }, 500);
  }
  function handleMsgPointerUp() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.key === "Escape") { setReplyTo(null); setShowAiMention(false); }
  }

  function formatTime(ts: Timestamp | null) {
    if (!ts) return "";
    return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const activeInfo = ALL_SUBJECTS.find(s => s.id === activeSubject);

  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()) || m.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  // Build messages with date separators
  type FeedItem = { type: "date"; label: string; key: string } | { type: "msg"; msg: Message };
  const feedItems: FeedItem[] = [];
  let lastDate: Date | null = null;
  for (const msg of filteredMessages) {
    const msgDate = msg.createdAt ? msg.createdAt.toDate() : null;
    if (msgDate && (!lastDate || !sameDay(lastDate, msgDate))) {
      feedItems.push({ type: "date", label: formatDateSeparator(msgDate), key: `sep-${msgDate.toDateString()}` });
      lastDate = msgDate;
    }
    feedItems.push({ type: "msg", msg });
  }

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading || step === "loading") return (
    <div className={styles.loadingScreen}><div className={styles.spinner} /></div>
  );

  // ── ONBOARDING ─────────────────────────────────────────────────────────────
  if (step === "onboarding") return (
    <>
      <Navbar />
      <main className={styles.onboardingMain}>
        <div className={styles.onboardingCard}>
          <div className={styles.obBadge}><span className={styles.pulseDot} /> Community</div>
          <h1>{joined.length > 0 ? "Join more communities" : "Which subjects do you want to join?"}</h1>
          <p>{joined.length > 0 ? "Pick more subjects to add to your sidebar." : "Select the communities you'd like to be part of."}</p>
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
              Join {selected.length > 0 ? `${selected.length} Communit${selected.length > 1 ? "ies" : "y"}` : "Communities"} →
            </button>
          </div>
        </div>
      </main>
    </>
  );

  // ── CHAT ───────────────────────────────────────────────────────────────────
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

      {/* Full emoji picker overlay */}
      {fullEmojiFor && (
        <div className={styles.emojiPickerOverlay} onClick={() => setFullEmojiFor(null)}>
          <div className={styles.fullEmojiPicker} onClick={e => e.stopPropagation()}>
            <div className={styles.fullEmojiTitle}>React</div>
            <div className={styles.fullEmojiGrid}>
              {ALL_EMOJIS.map(e => (
                <button key={e} className={styles.fullEmojiBtn} onClick={() => toggleReaction(fullEmojiFor, e)}>{e}</button>
              ))}
            </div>
          </div>
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
        <div className={styles.chatArea} onClick={() => { setQuickEmojiFor(null); setFullEmojiFor(null); setShowAiMention(false); }}>

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
            <button className={`${styles.searchToggle} ${showSearch ? styles.searchToggleActive : ""}`} onClick={() => { setShowSearch(p => !p); setSearchQuery(""); }}>🔍</button>
          </div>

          {/* Search */}
          {showSearch && (
            <div className={styles.searchBar}>
              <input autoFocus className={styles.searchInput} placeholder="Search messages..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              {searchQuery && <span className={styles.searchCount}>{filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""}</span>}
            </div>
          )}

          {/* Messages */}
          <div className={styles.messages}>
            {filteredMessages.length === 0 && !searchQuery && (
              <div className={styles.emptyChat}>
                <div className={styles.emptyChatIcon}>{activeInfo?.icon}</div>
                <div className={styles.emptyChatTitle}>No messages yet</div>
                <div className={styles.emptyChatSub}>Be the first! Type <strong>@AI</strong> to ask the AI a question.</div>
              </div>
            )}

            {feedItems.map((item) => {
              if (item.type === "date") {
                return (
                  <div key={item.key} className={styles.dateSeparator}>
                    <span className={styles.dateSeparatorLabel}>{item.label}</span>
                  </div>
                );
              }

              const msg = item.msg;
              const isMe = msg.uid === user?.uid;
              const isAI = msg.isAI === true;

              // Count total reactions
              const reactionSummary: Record<string, number> = {};
              if (msg.reactions) {
                Object.entries(msg.reactions).forEach(([emoji, uids]) => {
                  if (uids.length > 0) reactionSummary[emoji] = uids.length;
                });
              }

              return (
                <div
                  key={msg.id}
                  className={`${styles.msgRow} ${isMe ? styles.msgMe : styles.msgThem} ${isAI ? styles.msgAiRow : ""}`}
                  onPointerDown={() => handleMsgPointerDown(msg.id)}
                  onPointerUp={handleMsgPointerUp}
                  onPointerLeave={handleMsgPointerUp}
                  onMouseEnter={() => !fullEmojiFor && setQuickEmojiFor(msg.id)}
                  onMouseLeave={() => setQuickEmojiFor(prev => prev === msg.id ? null : prev)}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Avatar */}
                  {!isMe && (
                    <div className={`${styles.msgAvatar} ${isAI ? styles.aiAvatar : ""}`}>
                      {isAI
                        ? <span>✦</span>
                        : msg.photoURL
                          ? <img src={msg.photoURL} alt={msg.displayName} className={styles.msgAvatarImg} />
                          : <span>{getInitials(msg.displayName)}</span>}
                    </div>
                  )}

                  <div className={styles.msgBubbleWrap}>
                    {!isMe && <div className={`${styles.msgName} ${isAI ? styles.aiName : ""}`}>{msg.displayName}</div>}

                    {/* Reply preview */}
                    {msg.replyTo && (
                      <div className={`${styles.replyPreview} ${isMe ? styles.replyPreviewMe : ""}`}>
                        <div className={styles.replyPreviewName}>{msg.replyTo.displayName}</div>
                        <div className={styles.replyPreviewText}>{msg.replyTo.text}{msg.replyTo.text?.length >= 80 ? "…" : ""}</div>
                      </div>
                    )}

                    <div className={`${styles.msgBubble} ${isMe ? styles.bubbleMe : styles.bubbleThem} ${isAI ? styles.bubbleAI : ""}`}>
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="shared" className={styles.msgImage} onClick={() => setLightbox(msg.imageUrl!)} />
                      )}
                      {msg.text && <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>}
                    </div>

                    {/* Reaction pills */}
                    {Object.keys(reactionSummary).length > 0 && (
                      <div className={`${styles.reactionRow} ${isMe ? styles.reactionRowMe : ""}`}>
                        {Object.entries(reactionSummary).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            className={`${styles.reactionPill} ${msg.reactions?.[emoji]?.includes(user?.uid ?? "") ? styles.reactionPillActive : ""}`}
                            onClick={() => toggleReaction(msg.id, emoji)}
                          >
                            {emoji} {count}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={`${styles.msgMeta} ${isMe ? styles.metaMe : ""}`}>
                      <span className={styles.msgTime}>{formatTime(msg.createdAt)}</span>
                      {isMe && <button className={styles.deleteBtn} onClick={() => deleteMessage(msg.id)} title="Delete">✕</button>}
                      {!isAI && (
                        <button className={styles.replyBtn} onClick={() => setReplyTo(msg)} title="Reply">↩</button>
                      )}
                    </div>

                    {/* Quick emoji bar on hover */}
                    {quickEmojiFor === msg.id && !fullEmojiFor && (
                      <div className={`${styles.quickEmojiBar} ${isMe ? styles.quickEmojiBarMe : ""}`} onClick={e => e.stopPropagation()}>
                        {QUICK_EMOJIS.map(e => (
                          <button key={e} className={styles.quickEmojiBtn} onClick={() => toggleReaction(msg.id, e)}>{e}</button>
                        ))}
                        <button className={styles.quickEmojiMore} onClick={() => { setFullEmojiFor(msg.id); setQuickEmojiFor(null); }}>＋</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* AI loading bubble */}
            {aiLoading && (
              <div className={`${styles.msgRow} ${styles.msgThem} ${styles.msgAiRow}`}>
                <div className={`${styles.msgAvatar} ${styles.aiAvatar}`}><span>✦</span></div>
                <div className={styles.msgBubbleWrap}>
                  <div className={styles.msgName + " " + styles.aiName}>IGCSePulse AI</div>
                  <div className={`${styles.msgBubble} ${styles.bubbleThem} ${styles.bubbleAI}`}>
                    <div className={styles.typingDots}><span /><span /><span /></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className={styles.typingIndicator}>
              <div className={styles.typingDots}><span /><span /><span /></div>
              <span>{typingUsers.map(t => t.displayName).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...</span>
            </div>
          )}

          {/* Reply bar */}
          {replyTo && (
            <div className={styles.replyBar}>
              <div className={styles.replyBarContent}>
                <div className={styles.replyBarName}>Replying to {replyTo.displayName}</div>
                <div className={styles.replyBarText}>{replyTo.text?.slice(0, 80)}{(replyTo.text?.length ?? 0) > 80 ? "…" : ""}</div>
              </div>
              <button className={styles.replyBarClose} onClick={() => setReplyTo(null)}>✕</button>
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

          {/* Emoji picker for input */}
          {showEmoji && (
            <div className={styles.emojiPicker}>
              {ALL_EMOJIS.map(e => (
                <button key={e} className={styles.emojiBtn} onMouseDown={ev => { ev.preventDefault(); setText(t => t + e); setShowEmoji(false); }}>{e}</button>
              ))}
            </div>
          )}

          {/* @AI mention dropdown */}
          {showAiMention && (
            <div className={styles.mentionDropdown} onClick={e => e.stopPropagation()}>
              <button className={styles.mentionOption} onClick={insertAIMention}>
                <span className={styles.mentionIcon}>✦</span>
                <div>
                  <div className={styles.mentionName}>@AI — IGCSePulse AI</div>
                  <div className={styles.mentionSub}>Ask the AI a question in the chat</div>
                </div>
              </button>
            </div>
          )}

          {/* Input */}
          <div className={styles.inputBar}>
            <input type="file" accept="image/*" ref={fileRef} onChange={handleImagePick} className={styles.hiddenFileInput} />
            <button className={styles.attachBtn} onClick={() => fileRef.current?.click()} title="Attach image">📎</button>
            <button className={`${styles.attachBtn} ${showEmoji ? styles.attachActive : ""}`} onClick={() => setShowEmoji(p => !p)} title="Emoji">😊</button>
            <div style={{ position: "relative", flex: 1 }}>
              <textarea
                ref={textareaRef}
                className={styles.textInput}
                placeholder={`Message c/${activeSubject}... (type @ to mention AI)`}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                rows={1}
              />
            </div>
            <button className={styles.sendBtn} onClick={sendMessage} disabled={sending || (!text.trim() && !imageFile)}>
              {sending ? "..." : "↑"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
