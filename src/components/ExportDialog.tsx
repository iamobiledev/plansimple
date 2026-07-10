import { useState } from "react";
import { useStore } from "../store";
import { buildTakeoffPdf, type ExportOptions, type IconBitmap } from "../lib/exportPdf";

/** Rasterize any icon (incl. SVG) to PNG bytes so pdf-lib can embed it. */
async function rasterizeIcon(fileKey: string): Promise<IconBitmap | null> {
  try {
    const res = await fetch(`/api/files/${fileKey}`, { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const ratio = Math.min(size / img.naturalWidth, size / img.naturalHeight);
      const w = img.naturalWidth * ratio;
      const h = img.naturalHeight * ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!pngBlob) return null;
      return { bytes: new Uint8Array(await pngBlob.arrayBuffer()), format: "png" };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const measurements = useStore((s) => s.measurements);
  const showToast = useStore((s) => s.showToast);
  const [sheetsMode, setSheetsMode] = useState<ExportOptions["sheets"]>("all");
  const [legend, setLegend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!project) return null;

  const measuredCount = new Set(measurements.map((m) => m.sheetId)).size;

  async function onExport() {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      // Rasterize each distinct custom icon used by a count item.
      const iconKeys = [...new Set(project.conditions.map((c) => c.iconKey).filter(Boolean))] as string[];
      const iconBitmaps = new Map<string, IconBitmap>();
      for (const key of iconKeys) {
        const bmp = await rasterizeIcon(key);
        if (bmp) iconBitmaps.set(key, bmp);
      }

      const bytes = await buildTakeoffPdf({
        project,
        measurements,
        options: { sheets: sheetsMode, legend },
        iconBitmaps,
        fetchSheetPdf: async (sheet) => {
          const res = await fetch(sheet.fileUrl, { credentials: "same-origin" });
          if (!res.ok) throw new Error(`Failed to fetch ${sheet.name}`);
          return res.arrayBuffer();
        },
      });

      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.replace(/[^\w-]+/g, "_")}_Takeoff.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Takeoff PDF exported");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={busy ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Export takeoff PDF</h2>
        <p className="muted small">
          A customer-ready PDF: a branded cover page with your project details and quantity
          summary, followed by your plan sheets with color-coded measurements.
        </p>
        <label>
          Sheets to include
          <div className="segmented">
            <button
              type="button"
              className={sheetsMode === "all" ? "active" : ""}
              onClick={() => setSheetsMode("all")}
            >
              All sheets ({project.sheets.length})
            </button>
            <button
              type="button"
              className={sheetsMode === "measured" ? "active" : ""}
              onClick={() => setSheetsMode("measured")}
            >
              With measurements ({measuredCount})
            </button>
          </div>
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={legend} onChange={(e) => setLegend(e.target.checked)} />
          Include a takeoff legend on each sheet
        </label>
        {(!project.address || !project.clientName) && (
          <p className="muted small">
            Tip: add the site address and client in <em>Project details</em> (click the project
            name) — they appear on the cover page.
          </p>
        )}
        {error && <div className="form-error">{error}</div>}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void onExport()} disabled={busy}>
            {busy ? "Building PDF…" : "Export PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
