"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import styles from "./admin.module.css";

const ADMIN_UIDS = ["dEyvyhKqKueCFnWNC1zHiqiIMjj1", "rcqnr0PuqKab08NJ06NqLZTyXmz2"];
const SUBJECTS = ["business", "math", "physics", "chemistry", "computer-science", "english"];

const UPDATE_BADGES = ["New Feature", "Improvement", "Bug Fix", "Announcement", "Coming Soon"];

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
  const [pdfSubject, setPdfSubject]         = useState("business");
  const [pdfFile, setPdfFile]               = useState<File | null>(null);
  const [uploading, setUploading]           = useState(false);
  const [uploadMsg, setUploadMsg]           = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleteSubject, setDeleteSubject] = useState("business");
  const [deleteFilename, setDeleteFilename] = useState("");
  const [deleting, setDeleting]           = useState(false);
  const [deleteMsg, setDeleteMsg]         = useState("");

  // ── Update state ────────────────────────────────────────────────────────
  const [updateTitle, setUpdateTitle]   = useState("");
  const [updateBody, setUpdateBody]     = useState("");
  const [updateBadge, setUpdateBadge]   = useState(UPDATE_BADGES[0]);
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg]       = useState("");

  useEffect(() => {
    if (!loading && (!user || !ADMIN_UIDS.includes(user.uid))) {
      router.push("/");
    }
  }, [user, loading, router]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPdfFile(file);
    setDuplicateWarning(false);
    setUploadMsg("");
    if (!file) return;
    setCheckingDuplicate(true);
    try {
      const res = await fetch(`/api/check-pdf?filename=${encodeURIComponent(file.name)}&subject=${pdfSubject}`);
      const data = await res.json();
      if (data.exists) setDuplicateWarning(true);
    } catch { /* silently ignore */ }
    finally { setCheckingDuplicate(false); }
  }

  async function handleSubjectChange(newSubject: string) {
    setPdfSubject(newSubject);
    setDuplicateWarning(false);
    if (!pdfFile) return;
    setCheckingDuplicate(true);
    try {
      const res = await fetch(`/api/check-pdf?filename=${encodeURIComponent(pdfFile.name)}&subject=${newSubject}`);
      const data = await res.json();
      if (data.exists) setDuplicateWarning(true);
    } catch { /* silently ignore */ }
    finally { setCheckingDuplicate(false); }
  }

  async function handlePdfUpload() {
    if (!pdfFile) { setUploadMsg("Please select a PDF first."); return; }
    setUploading(true);
    setDuplicateWarning(false);

    try {
      setUploadMsg("Uploading PDF to storage...");
      const storageRef = ref(storage, `admin_uploads/${Date.now()}_${pdfFile.name}`);
      await uploadBytes(storageRef, pdfFile);
      const downloadUrl = await getDownloadURL(storageRef);

      setUploadMsg("Processing PDF with OCR and embedding...");
      let res: Response;
      try {
        res = await fetch("/api/upload-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl: downloadUrl, filename: pdfFile.name, subject: pdfSubject }),
        });
      } catch (fetchErr: any) {
        setUploadMsg(`❌ Network error: ${fetchErr?.message ?? String(fetchErr)}`);
        return;
      }

      if (!res.ok) {
        let body = "";
        try { body = await res.text(); } catch {}
        setUploadMsg(`❌ Server error ${res.status}: ${body || "(no body)"}`);
        return;
      }

      let data: any;
      try { data = await res.json(); }
      catch (jsonErr: any) {
        setUploadMsg(`❌ Could not parse server response: ${jsonErr?.message}`);
        return;
      }

      if (data.success) {
        setUploadMsg(`✅ ${data.filename} uploaded — ${data.chunks} chunks stored in Pinecone!`);
        setPdfFile(null);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setUploadMsg(`❌ Error: ${data.error}`);
      }
    } catch (err: any) {
      setUploadMsg(`❌ Upload failed: ${err?.message ?? String(err)}`);
    } finally {
      setUploading(false);
    }
  }

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

  async function handleDelete() {
    if (!deleteFilename.trim()) { setDeleteMsg("❌ Please enter a filename."); return; }
    setDeleting(true);
    setDeleteMsg("Deleting vectors from Pinecone...");
    try {
      const res = await fetch("/api/delete-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: deleteFilename.trim(), subject: deleteSubject }),
      });
      const data = await res.json();
      if (data.success) {
        setDeleteMsg(`✅ Deleted ${data.deleted} vectors for "${deleteFilename.trim()}" from Pinecone.`);
        setDeleteFilename("");
      } else {
        setDeleteMsg(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setDeleteMsg("❌ Delete failed. Please try again.");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  async function handlePostUpdate() {
    if (!updateTitle.trim() || !updateBody.trim()) {
      setUpdateMsg("❌ Please fill in the title and body."); return;
    }
    setPostingUpdate(true);
    try {
      const res = await fetch("/api/post-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: updateTitle.trim(), body: updateBody.trim(), badge: updateBadge, uid: user?.uid }),
      });
      const data = await res.json();
      if (data.success) {
        setUpdateMsg("✅ Update posted! It's now live on the /updates page.");
        setUpdateTitle(""); setUpdateBody(""); setUpdateBadge(UPDATE_BADGES[0]);
      } else {
        setUpdateMsg(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setUpdateMsg("❌ Failed to post update.");
      console.error(err);
    } finally {
      setPostingUpdate(false);
    }
  }

  if (loading || !user) return null;
  if (!ADMIN_UIDS.includes(user.uid)) return null;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <h1 className={styles.title}>Admin Panel</h1>

        {/* ── POST UPDATE SECTION ─────────────────────────────────────── */}
        <div className={styles.form}>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "18px", fontWeight: 800, margin: 0 }}>
            📣 Post Update / What&apos;s New
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink2)", margin: 0 }}>
            Post a new update that will appear on the <code style={{ background: "rgba(255,77,109,0.1)", color: "var(--pulse)", borderRadius: "4px", padding: "1px 5px" }}>/updates</code> page. A glowing <strong>New</strong> badge will appear in the navbar for all users until they visit the page.
          </p>

          {updateMsg && (
            <div className={styles.msg} style={{
              background: updateMsg.startsWith("✅") ? "rgba(0,201,167,0.1)" : "rgba(255,80,80,0.1)",
              color: updateMsg.startsWith("✅") ? "#00C9A7" : "#ff5050",
            }}>
              {updateMsg}
            </div>
          )}

          <div className={styles.field}>
            <label>Title</label>
            <input
              value={updateTitle}
              onChange={e => setUpdateTitle(e.target.value)}
              placeholder="e.g. AI Tutor now supports image uploads"
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Badge</label>
              <select value={updateBadge} onChange={e => setUpdateBadge(e.target.value)}>
                {UPDATE_BADGES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label>Body</label>
            <textarea
              value={updateBody}
              onChange={e => setUpdateBody(e.target.value)}
              rows={6}
              placeholder="Describe the update in detail. Markdown-style line breaks are preserved."
            />
          </div>

          <button
            className={styles.postBtn}
            onClick={handlePostUpdate}
            disabled={postingUpdate}
            style={{ background: "linear-gradient(135deg, var(--pulse), rgba(155,127,212,0.85))" }}
          >
            {postingUpdate ? "Posting..." : "Post Update 📣"}
          </button>
        </div>

        {/* ── PDF UPLOAD SECTION ──────────────────────────────────────── */}
        <div className={styles.form}>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "18px", fontWeight: 800, margin: 0 }}>
            📚 Upload Past Paper / Mark Scheme to AI
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink2)", margin: 0 }}>
            Upload a PDF and it will be stored in Pinecone so the AI can reference it when answering student questions.
          </p>

          {uploadMsg && (
            <div className={styles.msg} style={{
              background: uploadMsg.startsWith("✅") ? "rgba(0,201,167,0.1)" : "rgba(255,80,80,0.1)",
              color: uploadMsg.startsWith("✅") ? "#00C9A7" : "#ff5050",
              wordBreak: "break-word",
            }}>
              {uploadMsg}
            </div>
          )}

          {duplicateWarning && (
            <div className={styles.msg} style={{ background: "rgba(255,193,7,0.1)", color: "#FFC107" }}>
              ⚠️ This file already exists in Pinecone for this subject. You can still upload to overwrite it, or delete it first using the section below.
            </div>
          )}

          {checkingDuplicate && (
            <div style={{ fontSize: "12px", color: "var(--ink2)" }}>Checking for duplicates...</div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Subject</label>
              <select value={pdfSubject} onChange={e => handleSubjectChange(e.target.value)}>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>PDF File</label>
              <input type="file" accept=".pdf" ref={fileRef} onChange={handleFileChange} style={{ padding: "8px" }} />
            </div>
          </div>

          <button
            className={styles.postBtn}
            onClick={handlePdfUpload}
            disabled={uploading || !pdfFile || checkingDuplicate}
            style={{ background: "var(--accent)" }}
          >
            {uploading ? "Processing..." : duplicateWarning ? "Upload Anyway 🧠" : "Upload to AI Knowledge Base 🧠"}
          </button>
        </div>

        {/* ── DELETE SECTION ──────────────────────────────────────────── */}
        <div className={styles.form}>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "18px", fontWeight: 800, margin: 0 }}>
            🗑️ Delete PDF from AI
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink2)", margin: 0 }}>
            Remove a PDF&apos;s vectors from Pinecone. The filename must match exactly what was uploaded (e.g. <code>Chapter1.pdf</code>).
          </p>

          {deleteMsg && (
            <div className={styles.msg} style={{
              background: deleteMsg.startsWith("✅") ? "rgba(0,201,167,0.1)" : "rgba(255,80,80,0.1)",
              color: deleteMsg.startsWith("✅") ? "#00C9A7" : "#ff5050"
            }}>
              {deleteMsg}
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Subject</label>
              <select value={deleteSubject} onChange={e => setDeleteSubject(e.target.value)}>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Filename (exact)</label>
              <input
                type="text"
                value={deleteFilename}
                onChange={e => setDeleteFilename(e.target.value)}
                placeholder="e.g. Chapter1.pdf"
              />
            </div>
          </div>

          <button
            className={styles.postBtn}
            onClick={handleDelete}
            disabled={deleting || !deleteFilename.trim()}
            style={{ background: "rgba(255,77,109,0.85)" }}
          >
            {deleting ? "Deleting..." : "Delete from Pinecone 🗑️"}
          </button>
        </div>

        {/* ── CHALLENGE SECTION ───────────────────────────────────────── */}
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
