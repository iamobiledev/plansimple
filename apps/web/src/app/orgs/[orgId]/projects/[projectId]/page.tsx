"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Doc = {
  id: string;
  filename: string;
  pageCount: number;
  processingStatus: string;
  storageKey: string | null;
  currentRevisionId: string | null;
};

type DocDetail = Doc & {
  pages: Array<{ id: string; pageNumber: number; widthPts: number; heightPts: number }>;
};

type Markup = {
  id: string;
  pageId: string;
  type: string;
  geometry: { x?: number; y?: number; w?: number; h?: number; points?: Array<{ x: number; y: number }> };
  subject: string | null;
  status: string;
};

export default function ProjectWorkspacePage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scale, setScale] = useState(1.2);

  const refreshDocs = useCallback(async () => {
    const res = await fetch(`/api/organizations/${orgId}/projects/${projectId}/documents`);
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    setDocs(await res.json());
  }, [orgId, projectId, router]);

  useEffect(() => {
    void refreshDocs();
  }, [refreshDocs]);

  async function loadDoc(id: string) {
    const res = await fetch(`/api/organizations/${orgId}/documents/${id}`);
    const data = (await res.json()) as DocDetail;
    setDetail(data);
    setPageIndex(0);
    if (data.currentRevisionId) {
      const m = await fetch(
        `/api/organizations/${orgId}/revisions/${data.currentRevisionId}/markups`
      );
      setMarkups(await m.json());
    }
  }

  useEffect(() => {
    if (!detail?.storageKey) return;
    let cancelled = false;
    (async () => {
      const url = detail.storageKey!;
      const doc = await pdfjs.getDocument({ url }).promise;
      if (cancelled) return;
      const page = await doc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      // draw markups for this page
      const pageId = detail.pages[pageIndex]?.id;
      for (const m of markups.filter((x) => x.pageId === pageId)) {
        ctx.strokeStyle = "#e11d48";
        ctx.lineWidth = 2;
        const g = m.geometry || {};
        if (typeof g.x === "number" && typeof g.w === "number") {
          ctx.strokeRect(g.x * scale, g.y! * scale, g.w * scale, g.h! * scale);
        } else if (Array.isArray(g.points) && g.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(g.points[0]!.x * scale, g.points[0]!.y * scale);
          for (let i = 1; i < g.points.length; i++) {
            ctx.lineTo(g.points[i]!.x * scale, g.points[i]!.y * scale);
          }
          if (m.type === "polygon" || m.type === "cloud" || m.type === "area") ctx.closePath();
          ctx.stroke();
        }
      }
    })().catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [detail, pageIndex, markups, scale]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus("Uploading…");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/organizations/${orgId}/projects/${projectId}/documents`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setStatus(`Uploaded ${data.pageCount} pages`);
      await refreshDocs();
      await loadDoc(data.documentId);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function addRectMarkup() {
    if (!detail?.pages[pageIndex] || !detail.currentRevisionId) return;
    const page = detail.pages[pageIndex]!;
    const res = await fetch(`/api/organizations/${orgId}/markups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId: page.id,
        revisionId: detail.currentRevisionId,
        type: "rectangle",
        geometry: { x: 80, y: 120, w: 200, h: 120 },
        subject: "Demo markup",
        style: { stroke: "#e11d48" },
      }),
    });
    if (!res.ok) {
      setError("Failed to create markup");
      return;
    }
    const m = await fetch(
      `/api/organizations/${orgId}/revisions/${detail.currentRevisionId}/markups`
    );
    setMarkups(await m.json());
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <Link href={`/orgs/${orgId}`} className="text-sm font-semibold text-blue-600">
          ← Organization
        </Link>
        <h1 className="text-lg font-bold">Project drawings</h1>
        <form onSubmit={onUpload} className="ml-auto flex items-center gap-2">
          <input type="file" name="file" accept="application/pdf" className="text-sm" disabled={busy} />
          <button className="btn-primary" disabled={busy} type="submit">
            {busy ? "Working…" : "Upload PDF"}
          </button>
        </form>
      </header>
      {(error || status) && (
        <div className="border-b bg-slate-50 px-4 py-2 text-sm">
          {error ? <span className="text-red-600">{error}</span> : <span>{status}</span>}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 overflow-y-auto border-r bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Documents</p>
          <ul className="space-y-1">
            {docs.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    detail?.id === d.id ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50"
                  }`}
                  onClick={() => void loadDoc(d.id)}
                >
                  <div className="truncate font-medium">{d.filename}</div>
                  <div className="text-xs text-slate-500">
                    {d.processingStatus} · {d.pageCount}p
                  </div>
                </button>
              </li>
            ))}
            {!docs.length && <li className="text-sm text-slate-500">Upload a PDF to begin.</li>}
          </ul>
          {detail?.pages?.length ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Pages</p>
              <div className="flex flex-wrap gap-1">
                {detail.pages.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPageIndex(i)}
                    className={`rounded px-2 py-1 text-xs ${
                      i === pageIndex ? "bg-slate-900 text-white" : "bg-slate-100"
                    }`}
                  >
                    {p.pageNumber}
                  </button>
                ))}
              </div>
              <button type="button" className="btn-secondary mt-3 w-full text-xs" onClick={() => void addRectMarkup()}>
                Add demo rectangle
              </button>
              <label className="mt-3 block text-xs text-slate-500">
                Zoom
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full"
                />
              </label>
            </div>
          ) : null}
        </aside>
        <main className="flex-1 overflow-auto bg-slate-800 p-4">
          {detail ? (
            <canvas ref={canvasRef} className="mx-auto bg-white shadow-lg" />
          ) : (
            <div className="grid h-full place-items-center text-slate-300">Select or upload a document</div>
          )}
        </main>
      </div>
    </div>
  );
}
