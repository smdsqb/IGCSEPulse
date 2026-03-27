"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import styles from "./ask-ai.module.css";

const SUBJECTS = [
  { id: "business",         name: "Business Studies", code: "0450", icon: "📊" },
  { id: "math",             name: "Mathematics",       code: "0580", icon: "📐" },
  { id: "physics",          name: "Physics",           code: "0625", icon: "⚡" },
  { id: "chemistry",        name: "Chemistry",         code: "0620", icon: "🧪" },
  { id: "computer-science", name: "Computer Science",  code: "0478", icon: "💻" },
  { id: "english",          name: "English",           code: "0500", icon: "📖" },
];

const MARKS = ["2", "4", "6", "8", "10", "12"];

interface Message {
  id?: string;
  role: "user" | "ai";
  text: string;
  marks?: string | null;
  timestamp?: Timestamp | null;
}

interface Session {
  id: string;
  subject: string;
  firstQuestion: string;
  timestamp: Timestamp | null;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function AskAiPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [subject, setSubject]             = useState("business");
  const [marks, setMarks]                 = useState("");
  const [question, setQuestion]           = useState("");
  const [sending, setSending]             = useState(false);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [sessionId, setSessionId]         = useState<string>(genId());
  const [sessions, setSessions]           = useState<Record<string, Session[]>>({});
  const [openSubjects, setOpenSubjects]   = useState<Record<string, boolean>>({});
  const [activeSession, setActiveSession] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const unsubRef  = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Load all sessions grouped by subject
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "ai_chats", user.uid, "sessions"),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const grouped: Record<string, Session[]> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as Omit<Session, "id">;
        if (!grouped[data.subject]) grouped[data.subject] = [];
        grouped[data.subject].push({ id: d.id, ...data });
      });
      setSessions(grouped);
    });
    return unsub;
  }, [user]);

  // Subscribe to messages for a session
  const subscribeToSession = useCallback((sid: string) => {
    if (!user) return;
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    const q = query(
      collection(db, "ai_chats", user.uid, "sessions", sid, "messages"),
      orderBy("timestamp", "asc")
    );
    unsubRef.current = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
  }, [user]);

  // Subject change → fresh session
  useEffect(() => {
    const newId = genId();
    setSessionId(newId);
    setMessages([]);
    setActiveSession(null);
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
  }, [subject]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function newChat() {
    const newId = genId();
    setSessionId(newId);
    setMessages([]);
    setActiveSession(null);
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
  }

  function loadSession(sess: Session) {
    setSubject(sess.subject);
    setActiveSession(sess.id);
    setSessionId(sess.id);
    subscribeToSession(sess.id);
  }

  function toggleAccordion(subjectId: string) {
    setOpenSubjects((prev) => ({ ...prev, [subjectId]: !prev[subjectId] }));
  }

  async function askQuestion() {
    if (!question.trim() || sending || !user) return;
    const q = question.trim();
    setQuestion("");
    setSending(true);
    const currentSessionId = sessionId;
    const isFirst = messages.length === 0;

    if (isFirst) {
      await setDoc(doc(db, "ai_chats", user.uid, "sessions", currentSessionId), {
        subject,
        firstQuestion: q.slice(0, 80),
        timestamp: serverTimestamp(),
      });
      setActiveSession(currentSessionId);
      subscribeToSession(currentSessionId);
    }

    await addDoc(
      collection(db, "ai_chats", user.uid, "sessions", currentSessionId, "messages"),
      { role: "user", text: q, marks: marks || null, timestamp: serverTimestamp() }
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          subject,
          marks: marks ? parseInt(marks) : null,
          userId: user.uid,
          sessionId: currentSessionId,
          history: messages.slice(-6).map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.text,
          })),
        }),
      });
      const data = await res.json();
      await addDoc(
        collection(db, "ai_chats", user.uid, "sessions", currentSessionId, "messages"),
        { role: "ai", text: data.reply ?? "Sorry, something went wrong.", timestamp: serverTimestamp() }
      );
    } catch {
      await addDoc(
        collection(db, "ai_chats", user.uid, "sessions", currentSessionId, "messages"),
        { role: "ai", text: "Sorry, something went wrong. Please try again.", timestamp: serverTimestamp() }
      );
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(); }
  }

  function formatDate(ts: Timestamp | null) {
    if (!ts) return "";
    return ts.toDate().toLocaleDateString([], { month: "short", day: "numeric" });
  }

  const activeSubject = SUBJECTS.find((s) => s.id === subject);

  if (loading || !user) return (
    <div className={styles.loadingScreen}><div className={styles.spinner} /></div>
  );

  return (
    <>
      <Navbar />
      <div className={styles.layout}>

        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}>Past Chats</div>
            <button className={styles.newChat} onClick={newChat}>+ New</button>
          </div>
          <div className={styles.sidebarScroll}>
            {Object.keys(sessions).length === 0 && (
              <div className={styles.emptyHistory}>No chats yet. Ask your first question!</div>
            )}
            {SUBJECTS.map((s) => {
              const subSessions = sessions[s.id] ?? [];
              if (subSessions.length === 0) return null;
              const isOpen = openSubjects[s.id] ?? true;
              return (
                <div key={s.id} className={styles.subjectGroup}>
                  <button className={styles.subjectGroupHeader} onClick={() => toggleAccordion(s.id)}>
                    <span>{s.icon}</span>
                    <span className={styles.subjectGroupName}>{s.name}</span>
                    <span className={styles.subjectGroupCount}>{subSessions.length}</span>
                    <span className={styles.accordion}>{isOpen ? "▾" : "▸"}</span>
                  </button>
                  {isOpen && subSessions.map((sess) => (
                    <button
                      key={sess.id}
                      className={`${styles.historyItem} ${activeSession === sess.id ? styles.historyItemActive : ""}`}
                      onClick={() => loadSession(sess)}
                    >
                      <div className={styles.historyInfo}>
                        <div className={styles.historyQ}>
                          {sess.firstQuestion}{sess.firstQuestion.length >= 80 ? "..." : ""}
                        </div>
                        <div className={styles.historyMeta}>{formatDate(sess.timestamp)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </aside>

        {/* MAIN CHAT */}
        <div className={styles.chatMain}>
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderIcon}>✦</div>
            <div>
              <div className={styles.chatHeaderTitle}>{activeSubject?.icon} {activeSubject?.name}</div>
              <div className={styles.chatHeaderSub}>Powered by Groq · Cambridge IGCSE</div>
            </div>
            <button className={styles.newChatBtn} onClick={newChat}>+ New Chat</button>
          </div>

          <div className={styles.selectors}>
            <div className={styles.subjectTabs}>
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  className={`${styles.subjectTab} ${subject === s.id ? styles.subjectTabActive : ""}`}
                  onClick={() => setSubject(s.id)}
                >
                  <span>{s.icon}</span>
                  <span className={styles.subjectTabName}>{s.name}</span>
                  <span className={styles.subjectTabCode}>{s.code}</span>
                </button>
              ))}
            </div>
            <select className={styles.marksSelect} value={marks} onChange={(e) => setMarks(e.target.value)}>
              <option value="">Marks (optional)</option>
              {MARKS.map((m) => <option key={m} value={m}>{m} marks</option>)}
            </select>
          </div>

          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.emptyChat}>
                <div className={styles.emptyChatIcon}>✦</div>
                <div className={styles.emptyChatTitle}>Ask me anything about {activeSubject?.name}</div>
                <div className={styles.emptyChatSub}>Trained on the Cambridge IGCSE syllabus, past papers, and mark schemes.</div>
                <div className={styles.suggestions}>
                  {[
                    `Explain a 6-mark question for ${activeSubject?.name}`,
                    `What are the key topics in ${activeSubject?.name}?`,
                    `How do I get full marks on a definition question?`,
                  ].map((sugg) => (
                    <button key={sugg} className={styles.suggestion} onClick={() => setQuestion(sugg)}>{sugg}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={msg.id ?? i} className={`${styles.msgRow} ${msg.role === "user" ? styles.msgUser : styles.msgAi}`}>
                {msg.role === "ai" && <div className={styles.aiAvatar}>✦</div>}
                <div className={styles.msgBubbleWrap}>
                  {msg.role === "user" && msg.marks && (
                    <div className={styles.msgMeta}>{msg.marks} marks</div>
                  )}
                  <div className={`${styles.msgBubble} ${msg.role === "user" ? styles.bubbleUser : styles.bubbleAi}`}>
                    {msg.role === "ai"
                      ? msg.text.split("\n").map((line, j) => <p key={j}>{line}</p>)
                      : msg.text}
                  </div>
                  {msg.role === "ai" && (
                    <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(msg.text)}>📋 Copy</button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className={`${styles.msgRow} ${styles.msgAi}`}>
                <div className={styles.aiAvatar}>✦</div>
                <div className={`${styles.msgBubble} ${styles.bubbleAi}`}>
                  <div className={styles.typing}><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className={styles.inputArea}>
            <textarea
              className={styles.textInput}
              placeholder={`Ask about ${activeSubject?.name}... (Enter to send)`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <button className={styles.sendBtn} onClick={askQuestion} disabled={sending || !question.trim()}>
              {sending ? "..." : "↑"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
