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
function renderMarkdown(text: string, isCs: boolean) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim() || (isCs ? "python" : "");
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={`code-${i}`} className={styles.codeBlock}>
          {lang && <div className={styles.codeLang}>{lang}</div>}
          <pre><code>{codeLines.join("\n")}</code></pre>
          <button className={styles.copyCode} onClick={() => navigator.clipboard.writeText(codeLines.join("\n"))}>📋 Copy</button>
        </div>
      );
      i++; continue;
    }
    if (/^(\s*[-•*])\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*[-•*])\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-•*]\s/, "")); i++; }
      elements.push(<ul key={`ul-${i}`} className={styles.mdList}>{items.map((it, j) => <li key={j}>{inlineMd(it)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++; }
      elements.push(<ol key={`ol-${i}`} className={styles.mdList}>{items.map((it, j) => <li key={j}>{inlineMd(it)}</li>)}</ol>);
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      const level = (line.match(/^(#{1,3})/)?.[1].length ?? 1);
      const content = line.replace(/^#{1,3}\s/, "");
      const Tag = (`h${level + 2}`) as "h3"|"h4"|"h5";
      elements.push(<Tag key={`h-${i}`} className={styles.mdHeading}>{inlineMd(content)}</Tag>);
      i++; continue;
    }
    if (line.trim() === "") { i++; continue; }
    elements.push(<p key={`p-${i}`} className={styles.mdPara}>{inlineMd(line)}</p>);
    i++;
  }
  return <>{elements}</>;
}

function inlineMd(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className={styles.inlineCode}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function extractRawPDFText(binary: string): string {
  const textParts: string[] = [];
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let btMatch;
  while ((btMatch = btEtRegex.exec(binary)) !== null) {
    const block = btMatch[1];
    const tjRegex = /\(((?:[^()\\]|\\[\s\S])*)\)\s*(?:Tj|'|")/g;
    const tjArrayRegex = /\[((?:[^\[\]]|\((?:[^()\\]|\\[\s\S])*\))*)\]\s*TJ/g;
    let m;
    while ((m = tjRegex.exec(block)) !== null) {
      const t = m[1].replace(/\\n/g,' ').replace(/\\r/g,' ').replace(/\\t/g,' ').replace(/\\(\d{3})/g,(_,o)=>String.fromCharCode(parseInt(o,8))).replace(/\\(.)/g,'$1');
      if (t.trim()) textParts.push(t);
    }
    while ((m = tjArrayRegex.exec(block)) !== null) {
      const strRegex = /\(((?:[^()\\]|\\[\s\S])*)\)/g;
      let s;
      while ((s = strRegex.exec(m[1])) !== null) {
        const t = s[1].replace(/\\n/g,' ').replace(/\\r/g,' ').replace(/\\t/g,' ').replace(/\\(\d{3})/g,(_,o)=>String.fromCharCode(parseInt(o,8))).replace(/\\(.)/g,'$1');
        if (t.trim()) textParts.push(t);
      }
    }
  }
  return textParts.join(' ').replace(/\s+/g,' ').trim();
}

// ── Extract text from file client-side ──────────────────────────────────────
async function extractFileText(file: File): Promise<string> {
  // Plain text / code files
  if (file.type === "text/plain" || file.name.endsWith(".txt")) {
    return await file.text();
  }

  // PDF — server-side extraction via API route
  if (file.type === "application/pdf") {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/extract-pdf', { method: 'POST', body: formData });
      const { text } = await res.json();
      return text || "[Could not extract text from PDF]";
    } catch (err) {
      console.error("PDF parse error:", err);
      return "[PDF could not be read — please paste the text directly]";
    }
  }

  // Images — convert to base64 for vision context
  if (file.type.startsWith("image/")) {
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  // .docx / other — read as text best-effort
  try {
    return await file.text();
  } catch {
    return `[File: ${file.name} — could not extract text]`;
  }
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
  const [extracting, setExtracting]       = useState(false);

  const bottomRef        = useRef<HTMLDivElement>(null);
  const unsubRef         = useRef<(() => void) | null>(null);
  const fileRef          = useRef<HTMLInputElement>(null);
  const loadingSessionRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "ai_chats", user.uid, "sessions"), orderBy("timestamp", "desc"));
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

  useEffect(() => {
    if (loadingSessionRef.current) return;
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

  function loadSession(sess: Session) {
    if (activeSession === sess.id) return;
    loadingSessionRef.current = true;
    setMessages([]);
    setSubject(sess.subject);
    setActiveSession(sess.id);
    setSessionId(sess.id);
    subscribeToSession(sess.id);
    setTimeout(() => { loadingSessionRef.current = false; }, 100);
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
    let extractedContent: string | null = null;

    if (attachedFile) {
      setUploading(true);
      setExtracting(true);
      try {
        const storageRef = ref(storage, `ai_files/${user.uid}/${currentSessionId}/${Date.now()}_${attachedFile.name}`);
        await uploadBytes(storageRef, attachedFile);
        fileUrl = await getDownloadURL(storageRef);
        fileName = attachedFile.name;
        fileType = attachedFile.type;
        extractedContent = await extractFileText(attachedFile);
      } catch (err) {
        console.error("File processing error:", err);
      } finally {
        setUploading(false);
        setExtracting(false);
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
      { role: "user", text: q, marks: marks || null, fileUrl: fileUrl || null, fileName: fileName || null, fileType: fileType || null, timestamp: serverTimestamp() }
    );

    let fullQuestion = q;
    if (extractedContent) {
      if (fileType?.startsWith("image/")) {
        fullQuestion = `${q ? q + "\n\n" : ""}[The user has shared an image. Here is the base64 data — please describe what you see and help with any IGCSE-related content in it]\n${extractedContent.slice(0, 3000)}`;
      } else {
        fullQuestion = `${q ? q + "\n\n" : ""}[The user has uploaded a file: "${fileName}". Here is its content:]\n\n${extractedContent.slice(0, 4000)}`;
      }
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: fullQuestion || `[File uploaded: ${fileName}]`,
          subject,
          marks: marks ? parseInt(marks) : null,
          userId: user.uid,
          sessionId: currentSessionId,
          history: messages.slice(-6).map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.text || (m.fileName ? `[uploaded: ${m.fileName}]` : ""),
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
                        <div className={styles.historyQ}>{sess.firstQuestion}{sess.firstQuestion.length >= 80 ? "..." : ""}</div>
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
                <button key={s.id} className={`${styles.subjectTab} ${subject === s.id ? styles.subjectTabActive : ""}`} onClick={() => setSubject(s.id)}>
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
                  {isCs && " You can also upload code files or paste code for help!"}
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
                  {msg.role === "user" && msg.marks && <div className={styles.msgMeta}>{msg.marks} marks</div>}
                  <div className={`${styles.msgBubble} ${msg.role === "user" ? styles.bubbleUser : styles.bubbleAi}`}>
                    {msg.fileUrl && (
                      msg.fileType?.startsWith("image/")
                        ? <img src={msg.fileUrl} alt={msg.fileName ?? "attachment"} className={styles.attachedImage} />
                        : <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.attachedFile}>📎 {msg.fileName}</a>
                    )}
                    {msg.text && (msg.role === "ai" ? renderMarkdown(msg.text, isCs) : <span>{msg.text}</span>)}
                  </div>
                  {msg.role === "ai" && (
                    <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(msg.text)}>📋 Copy</button>
                  )}
                </div>
              </div>
            ))}

            {(sending || extracting) && (
              <div className={`${styles.msgRow} ${styles.msgAi}`}>
                <div className={styles.aiAvatar}>✦</div>
                <div className={styles.msgBubbleWrap}>
                  <div className={`${styles.msgBubble} ${styles.bubbleAi}`}>
                    <div className={styles.typing}>
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className={styles.inputArea}>
            {filePreview && (
              <div className={styles.filePreviewWrap}>
                <img src={filePreview} alt="preview" className={styles.filePreview} />
                <button className={styles.removeFile} onClick={clearFile}>✕</button>
              </div>
            )}
            {attachedFile && !filePreview && (
              <div className={styles.fileChip}>
                📎 {attachedFile.name}
                <button className={styles.removeFile} onClick={clearFile}>✕</button>
              </div>
            )}
            <div className={styles.inputRow}>
              <button className={styles.attachBtn} onClick={() => fileRef.current?.click()} title="Attach file">
                📎
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_FILES}
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <textarea
                className={styles.input}
                placeholder={`Ask about ${activeSubject?.name}... (Shift+Enter for new line)`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sending}
              />
              <button
                className={styles.sendBtn}
                onClick={askQuestion}
                disabled={sending || (!question.trim() && !attachedFile)}
              >
                {sending ? <div className={styles.btnSpinner} /> : "↑"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
