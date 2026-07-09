import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { renderThumbnail } from "../pdf";
import type { Sheet } from "../types";

function SheetThumb({ sheet }: { sheet: Sheet }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    renderThumbnail(sheet.fileUrl)
      .then((url) => alive && setSrc(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sheet.fileUrl]);
  return src ? (
    <img src={src} alt={sheet.name} className="sheet-thumb-img" draggable={false} />
  ) : (
    <div className="sheet-thumb-placeholder">…</div>
  );
}

export default function SheetSidebar() {
  const project = useStore((s) => s.project);
  const activeSheetId = useStore((s) => s.activeSheetId);
  const setActiveSheet = useStore((s) => s.setActiveSheet);
  const uploadPdf = useStore((s) => s.uploadPdf);
  const deleteSheet = useStore((s) => s.deleteSheet);
  const showToast = useStore((s) => s.showToast);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFileChosen(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadPdf(file);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <aside className="sheet-sidebar">
      <div className="panel-title">
        Sheets
        <button
          className="btn small primary"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? "Uploading…" : "+ Upload PDF"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => void onFileChosen(e.target.files)}
        />
      </div>
      <div className="sheet-list">
        {project?.sheets.length === 0 && (
          <p className="muted small pad">Upload a PDF plan set to get started.</p>
        )}
        {project?.sheets.map((sheet) => (
          <div
            key={sheet.id}
            className={`sheet-item ${sheet.id === activeSheetId ? "active" : ""}`}
            onClick={() => setActiveSheet(sheet.id)}
          >
            <SheetThumb sheet={sheet} />
            <div className="sheet-item-meta">
              <span className="sheet-item-name" title={sheet.name}>
                {sheet.name}
              </span>
              <span className={`small ${sheet.scalePixelsPerUnit ? "muted" : "warn"}`}>
                {sheet.scalePixelsPerUnit ? "Calibrated" : "Not calibrated"}
              </span>
            </div>
            <button
              className="btn subtle danger tiny"
              title="Delete sheet"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete sheet "${sheet.name}" and its measurements?`)) {
                  void deleteSheet(sheet.id);
                }
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
