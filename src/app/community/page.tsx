"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, onSnapshot, addDoc,
  serverTimestamp, limit,
} from "firebase/firestore";
import Navbar from "@/components/Navbar";
import styles from "./community.module.css";

const EMOJI_LIST = ["😂","🔥","💀","😭","🤯","👀","💯","🙏","😤","🥲","😩","🤝","👏","⚡","🎉","✨","💪","📚","🧠","😎"];

interface Message {
  id: string;
  uid: string;
  displayName: string;
  photoURL?: string;
  text: string;
  emoji?: string;
  createdAt: any;
  aiReply?: string;
  aiLoading?: boolean;
}

export default function CommunityPage() {
  const { user, loading } = useAuth();
  const [messages, setMessages]           = useState<Message[]>([]);
  const [text, setText]                   = useState("");
  const [sending, setSending]             = useState(false);
  const [showEmoji, setShowEmoji]         = useState(false);
  const [showAiDropdown, setShowAiDropdown] = useState(false);
  const [aiLoading, setAiLoading]         = useState<string | null>(null);
  const [atPosition, setAtPosition]       = useState<number | null>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const emojiRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, "community_messages"), orderBy("createdAt", "asc"), limit(100));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
    return unsub;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    }
    if (showEmoji) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmoji]);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setText(val);

    // Detect "@" typed
    const cursor = e.target.selectionStart ?? val.length;
    const lastAt = val.lastIndexOf("@", cursor - 1);
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === " " || val[lastAt - 1] === "\n")) {
      const query = val.slice(lastAt + 1, cursor);
      if (query === "" || "ask-ai".startsWith(query.toLowerCase()) || "ai".startsWith(query.toLowerCase())) {
        setShowAiDropdown(true);
        setAtPosition(lastAt);
        return;
      }
    }
    setShowAiDropdown(false);
    setAtPosition(null);
  }

  function selectAiMention() {
    if (atPosition === null) return;
    const before = text.slice(0, atPosition);
    const after  = text.slice(atPosition + 1 + (text.slice(atPosition + 1).search(/\s|$/))); // trim what was typed after @
    // Actually just replace from @ to cursor with @ask-ai 
    const cursor = inputRef.current?.selectionStart ?? text.length;
    const typed  = text.slice(atPosition + 1, cursor);
    const newText = text.slice(0, atPosition) + "@ask-ai " + text.slice(atPosition + 1 + typed.length);
    setText(newText);
    setShowAiDropdown(false);
    setAtPosition(null);
    inputRef.current?.focus();
  }

  function insertEmoji(emoji: string) {
    setText(prev => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  }

  async function handleSend() {
    if (!text.trim() || !user || sending) return;
    const msgText = text.trim();
    const isAiQuery = msgText.includes("@ask-ai");
    setText("");
    setSending(true);

    try {
      const docRef = await addDoc(collection(db, "community_messages"), {
        uid: user.uid,
        displayName: user.displayName ?? user.email?.split("@")[0] ?? "Student",
        photoURL: user.photoURL ?? null,
        text: msgText,
        createdAt: serverTimestamp(),
      });

      if (isAiQuery) {
        const question = msgText.replace("@ask-ai", "").trim();
        if (!question) { setSending(false); return; }

        // Show loading state by adding a temp message
        setAiLoading(docRef.id);

        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question,
              subject: "general",
              marks: 0,
              userId: user.uid,
              sessionId: "community",
              history: [],
            }),
          });
          const data = await res.json();
          const aiAnswer = data.reply ?? "Sorry, I couldn't answer that.";

          await addDoc(collection(db, "community_messages"), {
            uid: "ai-bot",
            displayName: "IGCSEPulse AI ✦",
            photoURL: null,
            text: aiAnswer,
            isAiReply: true,
            replyTo: docRef.id,
            createdAt: serverTimestamp(),
          });
        } catch {
          await addDoc(collection(db, "community_messages"), {
            uid: "ai-bot",
            displayName: "IGCSEPulse AI ✦",
            photoURL: null,
            text: "Sorry, I ran into an error. Please try again!",
            isAiReply: true,
            replyTo: docRef.id,
            createdAt: serverTimestamp(),
          });
        } finally {
          setAiLoading(null);
        }
      }
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showAiDropdown && e.key === "Enter") {
      e.preventDefault();
      selectAiMention();
      return;
    }
    if (showAiDropdown && e.key === "Escape") {
      setShowAiDropdown(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) return <div className={styles.loadingScreen}><div className={styles.spinner}/></div>;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.chatHeader}>
          <div className={styles.headerBadge}>💬 Community</div>
          <h1>Student Chat</h1>
          <p>Ask questions, share tips, or tag <code>@ask-ai</code> for instant AI help</p>
        </div>

        <div className={styles.chatBox}>
          <div className={styles.messages}>
            {messages.map(msg => {
              const isMe    = msg.uid === user?.uid;
              const isAiBot = msg.uid === "ai-bot";
              const initials = msg.displayName?.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase() ?? "?";
              return (
                <div key={msg.id} className={`${styles.msgRow} ${isMe ? styles.msgMe : ""} ${isAiBot ? styles.msgAi : ""}`}>
                  {!isMe && (
                    <div className={`${styles.avatar} ${isAiBot ? styles.avatarAi : ""}`}>
                      {msg.photoURL && !isAiBot
                        ? <img src={msg.photoURL} alt="" className={styles.avatarImg}/>
                        : isAiBot ? "✦" : initials}
                    </div>
                  )}
                  <div className={styles.msgContent}>
                    {!isMe && <div className={styles.msgName}>{msg.displayName}</div>}
                    <div className={`${styles.bubble} ${isMe ? styles.bubbleMe : ""} ${isAiBot ? styles.bubbleAi : ""}`}>
                      {msg.text}
                    </div>
                  </div>
                  {isMe && (
                    <div className={styles.avatar}>
                      {user?.photoURL
                        ? <img src={user.photoURL} alt="" className={styles.avatarImg}/>
                        : initials}
                    </div>
                  )}
                </div>
              );
            })}
            {aiLoading && (
              <div className={`${styles.msgRow} ${styles.msgAi}`}>
                <div className={`${styles.avatar} ${styles.avatarAi}`}>✦</div>
                <div className={styles.msgContent}>
                  <div className={styles.msgName}>IGCSEPulse AI ✦</div>
                  <div className={`${styles.bubble} ${styles.bubbleAi}`}>
                    <span className={styles.typingDots}><span/><span/><span/></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* INPUT AREA */}
          <div className={styles.inputArea}>
            {showAiDropdown && (
              <div className={styles.atDropdown}>
                <button className={styles.atOption} onMouseDown={e => { e.preventDefault(); selectAiMention(); }}>
                  <span className={styles.atOptionIcon}>✦</span>
                  <div>
                    <div className={styles.atOptionName}>@ask-ai</div>
                    <div className={styles.atOptionDesc}>Ask IGCSEPulse AI a question in chat</div>
                  </div>
                </button>
              </div>
            )}

            <div className={styles.inputRow}>
              <div className={styles.emojiWrap} ref={emojiRef}>
                <button
                  className={styles.emojiBtn}
                  type="button"
                  onClick={() => setShowEmoji(p => !p)}
                  title="Emoji"
                >😊</button>
                {showEmoji && (
                  <div className={styles.emojiPicker}>
                    {EMOJI_LIST.map(e => (
                      <button
                        key={e}
                        className={styles.emojiItem}
                        type="button"
                        onMouseDown={ev => { ev.preventDefault(); insertEmoji(e); }}
                      >{e}</button>
                    ))}
                  </div>
                )}
              </div>

              <textarea
                ref={inputRef}
                className={styles.input}
                placeholder={user ? 'Message... type @ for AI help' : 'Sign in to chat'}
                value={text}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                disabled={!user || sending}
                rows={1}
              />

              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!user || !text.trim() || sending}
                title="Send"
              >
                {sending ? "..." : "↑"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
