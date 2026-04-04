"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import styles from "./admin.module.css";

const ADMIN_UIDS = ["dEyvyhKqKueCFnWNC1zHiqiIMjj1"];
const SUBJECTS = ["business", "math", "physics", "chemistry", "computer-science", "english"];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Challenge state
  const [title, setTitle]           = useState("");
  const [question, setQuestion]     = useState("");
  const [subject, setSubject]       = useState("business");
  const [marks, setMarks]           = useState(4);
  const [difficulty, setDifficulty] = useState("medium");
  const [timeLimit, setTimeLimit]   = useState(15);
  const [keywords, setKeywords]     = useState("");
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState("");

  // PDF upload state
  const [pdfSubject, setPdfSubject]   = useState("business");
  const [pdfFile, setPdfFile]         = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadMsg, setUploadMsg]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
      setTitle(""); setQuestion(""); setKeywords("");
    } catch (err) {
      setMsg("Error posting challenge.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handlePdfUpload() {
    if (!pdfFile) { setUploadMsg("Please select a PDF first."); return; }
    setUploading(true);
    setUploadMsg("Uploading and processing PDF...");
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("subject", pdfSubject);
      const res = await fetch("/api/upload-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadMsg(`✅ ${data.filename} uploaded — ${data.chunks} chunks stored in Pinecone!`);
        setPdfFile(null);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setUploadMsg(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setUploadMsg("❌ Upload failed. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  if (loading || !user) return null;
  if (!ADMIN_UIDS.includes(user.uid)) return null;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <h1 className={styles.title}>Admin Panel</h1>

        {/* PDF UPLOAD SECTION */}
        <div className={styles.form}>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "18px", fontWeight: 800, margin: 0 }}>
            📚 Upload Past Paper / Mark Scheme to AI
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink2)", margin: 0 }}>
            Upload a PDF and it will be stored in Pinecone so the AI can reference it when answering student questions.
          </p>

          {uploadMsg && (
            <div className={styles.msg} style={{ background: uploadMsg.startsWith("✅") ? "rgba(0,201,167,0.1)" : "rgba(255,80,80,0.1)", color: uploadMsg.startsWith("✅") ? "#00C9A7" : "#ff5050" }}>
              {uploadMsg}
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Subject</label>
              <select value={pdfSubject} onChange={e => setPdfSubject(e.target.value)}>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>PDF File</label>
              <input
                type="file"
                accept=".pdf"
                ref={fileRef}
                onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
                style={{ padding: "8px" }}
              />
            </div>
          </div>

          <button className={styles.postBtn} onClick={handlePdfUpload} disabled={uploading || !pdfFile}
            style={{ background: "var(--accent)" }}>
            {uploading ? "Processing..." : "Upload to AI Knowledge Base 🧠"}
          </button>
        </div>

        {/* CHALLENGE SECTION */}
        <div className={styles.form}>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "18px", fontWeight: 800, margin: 0 }}>
            ⚡ Post Challenge
          </h2>

          {msg && <div className={styles.msg}>{msg}</div>}

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
            <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. opportunity cost, scarcity, choice" />
            <span className={styles.hint}>Key points the AI checks for in student answers</span>
          </div>
          <button className={styles.postBtn} onClick={handlePost} disabled={saving}>
            {saving ? "Posting..." : "Post Challenge ⚡"}
          </button>
        </div>

      </main>
    </>
  );
}
