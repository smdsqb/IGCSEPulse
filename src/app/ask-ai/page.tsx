"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, setDoc, doc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

const ACCEPTED_FILES = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt";

interface Message {
  id?: string;
  role: "user" | "ai";
  text: string;
  marks?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
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

// ── Markdown renderer ────────────────────────────────────────────────────────
// Handles: **bold**, *italic*, `code`, ```code blocks```, bullet lists, numbered lists
function renderMarkdown(text: string, isCs: boolean) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim() || (isCs ? "python" : "");
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className={styles.codeBlock}>
          {lang && <div className={styles.codeLang}>{lang}</div>}
          <pre><code>{codeLines.join("\n")}</code></pre>
          <button
            className={styles.copyCode}
            onClick={() => navigator.clipboard.writeText(codeLines.join("\n"))}
          >📋 Copy</button>
        </div>
      );
      i++;
      continue;
    }

    // Bullet list
    if (/^(\s*[-•*])\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*[-•*])\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-•*]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={i} className={styles.mdList}>
          {items.map((item, j) => <li key={j}>{inlineMarkdown(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={i} className={styles.mdList}>
          {items.map((item, j) => <li key={j}>{inlineMarkdown(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Heading
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})/)?.[1].length ?? 1;
      const content = line.replace(/^#{1,3}\s/, "");
      const Tag = `h${level + 2}` as "h3" | "h4" | "h5";
      elements.push(<Tag key={i} className={styles.mdHeading}>{inlineMarkdown(content)}</Tag>);
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    elements.push(<p key={i} className={styles.mdPara}>{inlineMarkdown(line)}</p>);
    i++;
  }

  return <>{elements}</>;
}

function inlineMarkdown(text: string): React.ReactNode {
  // Process **bold**, *italic*, `code` inline
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className={styles.inlineCode}>{part.slice(1, -1)}</code>;
    return part;
  });
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
  const [attachedFile, setAttachedFile]   = useState<File | null>(null);
  const [filePreview, setFilePreview]     = useState<string | null>(null);
  const [uploading, setUploading]         = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const unsubRef  = useRef<(() => void) | null>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

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
    clearFile();
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
  }

  // Single-tap load — no double-tap needed
  function loadSession(sess: Session) {
    if (activeSession === sess.id) return; // already loaded
    setSubject(sess.subject);
    setActiveSession(sess.id);
    setSessionId(sess.id);
    setMessages([]); // clear immediately so old messages don't flash
    subscribeToSession(sess.id);
  }

  function toggleAccordion(subjectId: string) {
    setOpenSubjects((prev) => ({ ...prev, [subjectId]: !prev[subjectId] }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
  }

  function clearFile() {
    setAttachedFile(null);
    setFilePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function askQuestion() {
    if ((!question.trim() && !attachedFile) || sending || !user) return;
    const q = question.trim();
    setQuestion("");
    setSending(true);
    const currentSessionId = sessionId;
    const isFirst = messages.length === 0;

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileType: string | null = null;

    // Upload file if attached
    if (attachedFile) {
      setUploading(true);
      try {
        const storageRef = ref(storage, `ai_files/${user.uid}/${currentSessionId}/${Date.now()}_${attachedFile.name}`);
        await uploadBytes(storageRef, attachedFile);
        fileUrl = await getDownloadURL(storageRef);
        fileName = attachedFile.name;
        fileType = attachedFile.type;
      } catch (err) {
        console.error("File upload error:", err);
      } finally {
        setUploading(false);
        clearFile();
      }
    }

    if (isFirst) {
      await setDoc(doc(db, "ai_chats", user.uid, "sessions", currentSessionId), {
        subject,
        firstQuestion: (q || fileName || "File upload").slice(0, 80),
        timestamp: serverTimestamp(),
      });
      setActiveSession(currentSessionId);
      subscribeToSession(currentSessionId);
    }

    await addDoc(
      collection(db, "ai_chats", user.uid, "sessions", currentSessionId, "messages"),
      {
        role: "user",
        text: q,
        marks: marks || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        timestamp: serverTimestamp(),
      }
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q || `[User uploaded a file: ${fileName}]`,
          subject,
          marks: marks ? parseInt(marks) : null,
          userId: user.uid,
          sessionId: currentSessionId,
          fileUrl,
          fileName,
          history: messages.slice(-6).map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.text || (m.fileName ? `[uploaded file: ${m.fileName}]` : ""),
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

  function isImage(type: string | null | undefined) {
    return type?.startsWith("image/") ?? false;
  }

  const activeSubject = SUBJECTS.find((s) => s.id === subject);
  const isCs = subject === "computer-science";

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
                <div className={styles.emptyChatSub}>
                  Trained on the Cambridge IGCSE syllabus, past papers, and mark schemes.
                  {isCs && " Upload code or paste it in for help!"}
                </div>
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
                    {/* File attachment display */}
                    {msg.fileUrl && (
                      isImage(msg.fileType)
                        ? <img src={msg.fileUrl} alt={msg.fileName ?? "attachment"} className={styles.attachedImage} />
                        : <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.attachedFile}>
                            📎 {msg.fileName}
                          </a>
                    )}
                    {/* Message text with markdown */}
                    {msg.text && (
                      msg.role === "ai"
                        ? renderMarkdown(msg.text, isCs)
                        : <span>{msg.text}</span>
                    )}
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
                <div className={`${styles.msgBubble} ${styles.bubbleAi}`}>
                  <div className={styles.typing}><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* File preview bar */}
          {attachedFile && (
            <div className={styles.filePreviewBar}>
              {filePreview
                ? <img src={filePreview} alt="preview" className={styles.filePreviewThumb} />
                : <span className={styles.filePreviewIcon}>📎</span>
              }
              <span className={styles.filePreviewName}>{attachedFile.name}</span>
              <span className={styles.filePreviewSize}>({(attachedFile.size / 1024).toFixed(0)}KB)</span>
              <button className={styles.filePreviewRemove} onClick={clearFile}>✕</button>
            </div>
          )}

          {/* Input area */}
          <div className={styles.inputArea}>
            <input
              type="file"
              accept={ACCEPTED_FILES}
              ref={fileRef}
              onChange={handleFileChange}
              className={styles.hiddenFile}
            />
            <button
              className={`${styles.attachBtn} ${attachedFile ? styles.attachBtnActive : ""}`}
              onClick={() => fileRef.current?.click()}
              title="Attach file (images, PDFs, docs)"
            >
              📎
            </button>
            <textarea
              className={styles.textInput}
              placeholder={
                attachedFile
                  ? `Add a message about ${attachedFile.name}... (optional)`
                  : `Ask about ${activeSubject?.name}... (Enter to send)`
              }
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <button
              className={styles.sendBtn}
              onClick={askQuestion}
              disabled={sending || uploading || (!question.trim() && !attachedFile)}
            >
              {uploading ? "⏫" : sending ? "..." : "↑"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
