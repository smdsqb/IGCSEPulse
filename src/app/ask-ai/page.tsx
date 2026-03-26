"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import styles from "./ask-ai.module.css";

const SUBJECTS = [
  { id: "business",        name: "Business Studies", code: "0450", icon: "📊" },
  { id: "math",            name: "Mathematics",       code: "0580", icon: "📐" },
  { id: "physics",         name: "Physics",           code: "0625", icon: "⚡" },
  { id: "chemistry",       name: "Chemistry",         code: "0620", icon: "🧪" },
  { id: "computer-science",name: "Computer Science",  code: "0478", icon: "💻" },
  { id: "english",         name: "English",           code: "0500", icon: "📖" },
];

const MARKS = ["", "2", "4", "6", "8", "10", "12"];

interface ChatHistory {
  id: string;
  subject: string;
  question: string;
  answer: string;
  marks: number | null;
  timestamp: Timestamp | null;
}

interface Message {
  role: "user" | "ai";
  text: string;
  subject?: string;
  marks?: string;
}

export default function AskAiPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [subject, setSubject]     = useState("business");
  const [marks, setMarks]         = useState("");
  const [question, setQuestion]   = useState("");
  const [sending, setSending]     = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [history, setHistory]     = useState<ChatHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Load chat history from Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "ai_chats"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatHistory)));
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function askQuestion() {
    if (!question.trim() || sending) return;
    const q = question.trim();
    setQuestion("");
    setSending(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", text: q, subject, marks },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          subject,
          marks: marks ? parseInt(marks) : null,
          userId: user?.uid ?? null,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "ai", text: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  }

  function loadFromHistory(item: ChatHistory) {
    setMessages([
      { role: "user", text: item.question, subject: item.subject, marks: item.marks?.toString() ?? "" },
      { role: "ai", text: item.answer },
    ]);
    setSubject(item.subject);
    setShowHistory(false);
  }

  function formatDate(ts: Timestamp | null) {
    if (!ts) return "";
    return ts.toDate().toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const activeSubject = SUBJECTS.find((s) => s.id === subject);

  if (loading || !user) return (
    <div className={styles.loadingScreen}><div className={styles.spinner} /></div>
  );

  return (
    <>
      <Navbar />
      <div className={styles.layout}>

        {/* SIDEBAR — history */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}>Chat History</div>
            <button className={styles.newChat} onClick={() => setMessages([])}>+ New</button>
          </div>
          {history.length === 0 && (
            <div className={styles.emptyHistory}>No chats yet. Ask your first question!</div>
          )}
          {history.map((item) => {
            const s = SUBJECTS.find((x) => x.id === item.subject);
            return (
              <button key={item.id} className={styles.historyItem} onClick={() => loadFromHistory(item)}>
                <div className={styles.historyIcon}>{s?.icon ?? "✦"}</div>
                <div className={styles.historyInfo}>
                  <div className={styles.historyQ}>{item.question.slice(0, 50)}{item.question.length > 50 ? "..." : ""}</div>
                  <div className={styles.historyMeta}>{s?.name} · {formatDate(item.timestamp)}</div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* MAIN CHAT */}
        <div className={styles.chatMain}>

          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderIcon}>✦</div>
            <div>
              <div className={styles.chatHeaderTitle}>Ask AI</div>
              <div className={styles.chatHeaderSub}>Powered by DeepSeek · Cambridge IGCSE syllabus</div>
            </div>
            <button className={styles.historyToggle} onClick={() => setShowHistory(p => !p)}>📋 History</button>
          </div>

          {/* Subject + Marks selectors */}
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
              {MARKS.filter(m => m !== "").map((m) => (
                <option key={m} value={m}>{m} marks</option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.emptyChat}>
                <div className={styles.emptyChatIcon}>✦</div>
                <div className={styles.emptyChatTitle}>Ask me anything about {activeSubject?.name}</div>
                <div className={styles.emptyChatSub}>I&apos;m trained on the full Cambridge IGCSE syllabus, past papers, and mark schemes.</div>
                <div className={styles.suggestions}>
                  {[
                    `Explain a 6-mark question for ${activeSubject?.name}`,
                    `What are the key topics in ${activeSubject?.name}?`,
                    `How do I get full marks on a definition question?`,
                  ].map((s) => (
                    <button key={s} className={styles.suggestion} onClick={() => setQuestion(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`${styles.msgRow} ${msg.role === "user" ? styles.msgUser : styles.msgAi}`}>
                {msg.role === "ai" && (
                  <div className={styles.aiAvatar}>✦</div>
                )}
                <div className={styles.msgBubbleWrap}>
                  {msg.role === "user" && msg.subject && (
                    <div className={styles.msgMeta}>
                      {SUBJECTS.find(s => s.id === msg.subject)?.icon} {SUBJECTS.find(s => s.id === msg.subject)?.name}
                      {msg.marks && ` · ${msg.marks} marks`}
                    </div>
                  )}
                  <div className={`${styles.msgBubble} ${msg.role === "user" ? styles.bubbleUser : styles.bubbleAi}`}>
                    {msg.role === "ai"
                      ? msg.text.split("\n").map((line, j) => <p key={j}>{line}</p>)
                      : msg.text
                    }
                  </div>
                  {msg.role === "ai" && (
                    <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(msg.text)}>
                      📋 Copy
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className={`${styles.msgRow} ${styles.msgAi}`}>
                <div className={styles.aiAvatar}>✦</div>
                <div className={styles.msgBubble} style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className={styles.typing}>
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className={styles.inputArea}>
            <textarea
              className={styles.textInput}
              placeholder={`Ask about ${activeSubject?.name}... (Enter to send, Shift+Enter for new line)`}
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
