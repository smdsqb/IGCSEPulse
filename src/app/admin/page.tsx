"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import styles from "./admin.module.css";

// 🔒 Put your Firebase UID here to restrict access
const ADMIN_UIDS = ["dEyvyhKqKueCFnWNC1zHiqiIMjj1"];

const SUBJECTS = ["business", "math", "physics", "chemistry", "computer-science", "english"];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [title, setTitle]           = useState("");
  const [question, setQuestion]     = useState("");
  const [subject, setSubject]       = useState("business");
  const [marks, setMarks]           = useState(4);
  const [difficulty, setDifficulty] = useState("medium");
  const [timeLimit, setTimeLimit]   = useState(15);
  const [keywords, setKeywords]     = useState("");
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState("");

  useEffect(() => {
    if (!loading && (!user || !ADMIN_UIDS.includes(user.uid))) {
      router.push("/");
    }
  }, [user, loading, router]);

  async function handlePost() {
    if (!title.trim() || !question.trim() || !keywords.trim()) {
      setMsg("Please fill in all fields."); return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "challenges"), {
        title: title.trim(),
        question: question.trim(),
        subject,
        marks,
        difficulty,
        timeLimit,
        keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
        date: new Date().toISOString().split("T")[0],
        createdAt: serverTimestamp(),
      });
      setMsg("Challenge posted!");
      setTitle("");
      setQuestion("");
      setKeywords("");
    } catch (err) {
      setMsg("Error posting challenge.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return null;
  if (!ADMIN_UIDS.includes(user.uid)) return null;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <h1 className={styles.title}>Admin — Post Challenge</h1>

        {msg && <div className={styles.msg}>{msg}</div>}

        <div className={styles.form}>
          <div className={styles.field}>
            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Explain opportunity cost" />
          </div>

          <div className={styles.field}>
            <label>Question</label>
            <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={5} placeholder="Write the full question here..." />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)}>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Marks</label>
              <input type="number" value={marks} onChange={e => setMarks(Number(e.target.value))} min={1} max={20} />
            </div>
            <div className={styles.field}>
              <label>Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Time (mins)</label>
              <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} min={5} max={60} />
            </div>
          </div>

          <div className={styles.field}>
            <label>Keywords (comma separated)</label>
            <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. opportunity cost, scarcity, choice, trade-off" />
            <span className={styles.hint}>These are the key points the AI checks for in the student's answer</span>
          </div>

          <button className={styles.postBtn} onClick={handlePost} disabled={saving}>
            {saving ? "Posting..." : "Post Challenge ⚡"}
          </button>
        </div>
      </main>
    </>
  );
}
