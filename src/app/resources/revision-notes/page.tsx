import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import styles from "../drive.module.css";
import revisionData from "@/data/revision-notes.json";

const FILE_ICONS: Record<string, string> = {
  pdf:  "📄",
  docx: "📝",
  doc:  "📝",
  pptx: "📊",
  ppt:  "📊",
  png:  "🖼️",
  jpg:  "🖼️",
  jpeg: "🖼️",
};

function getIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? "📎";
}

function getExt(filename: string) {
  return filename.split(".").pop()?.toUpperCase() ?? "FILE";
}

export default function RevisionNotesPage() {
  const totalFiles = revisionData.subjects.reduce((acc, s) => acc + s.files.length, 0);

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        {/* Header */}
        <div className={styles.header}>
          <Link href="/resources" className={styles.backLink}>← Resources</Link>
          <div className={styles.headerRow}>
            <div>
              <div className={styles.badge}>
                <span className={styles.pulseDot} />
                Revision Notes
              </div>
              <h1>🗒️ Revision Notes</h1>
              <p>Concise notes covering every IGCSE topic, organised by subject.</p>
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={styles.statNum}>{totalFiles}</div>
                <div className={styles.statLabel}>Files</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statNum}>{revisionData.subjects.length}</div>
                <div className={styles.statLabel}>Subjects</div>
              </div>
            </div>
          </div>
        </div>

        {/* Subject folders */}
        <div className={styles.subjects}>
          {revisionData.subjects.map((subject) => (
            <div key={subject.id} className={styles.subjectSection}>
              <div className={styles.subjectHeader}>
                <span className={styles.subjectIcon}>{subject.icon}</span>
                <div>
                  <div className={styles.subjectName}>{subject.name}</div>
                  <div className={styles.subjectCode}>IGCSE · {subject.code}</div>
                </div>
                <span className={styles.fileCount}>
                  {subject.files.length} {subject.files.length === 1 ? "file" : "files"}
                </span>
              </div>

              {subject.files.length === 0 ? (
                <div className={styles.emptyFolder}>
                  No files yet — check back soon!
                </div>
              ) : (
                <div className={styles.fileGrid}>
                  {(subject.files as Array<{ name: string; path: string; size?: string; addedDate?: string }>).map((file) => (
                    <a
                      key={file.path}
                      href={file.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.fileCard}
                      download
                    >
                      <div className={styles.fileIcon}>{getIcon(file.name)}</div>
                      <div className={styles.fileInfo}>
                        <div className={styles.fileName}>{file.name}</div>
                        <div className={styles.fileMeta}>
                          <span className={styles.fileExt}>{getExt(file.name)}</span>
                          {file.size && <span>{file.size}</span>}
                          {file.addedDate && <span>{file.addedDate}</span>}
                        </div>
                      </div>
                      <div className={styles.fileDownload}>⬇</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.updatedNote}>
          Last updated: {revisionData.lastUpdated}
        </div>
      </main>
      <Footer />
    </>
  );
}
