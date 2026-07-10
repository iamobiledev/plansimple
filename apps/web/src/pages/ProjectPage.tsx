import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuthStore } from "../store/auth";
import TileViewport from "../viewer/TileViewport";
import { FeatureFlagGate } from "../components/FeatureFlags";
import MarkupListPanel from "../components/MarkupListPanel";

type DocRow = {
  id: string;
  filename: string;
  pageCount: number;
  processingStatus: string;
  currentRevisionId: string | null;
};

type PageRow = {
  id: string;
  pageNumber: number;
  widthPts: number;
  heightPts: number;
  processingStatus: string;
};

type DocDetail = DocRow & { pages: PageRow[] };

type TextLayer = {
  spans: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }>;
};

export default function ProjectPage() {
  const { orgId, projectId } = useParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [tilePrefix, setTilePrefix] = useState<string | null>(null);
  const [text, setText] = useState<TextLayer | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const authHeader = accessToken ? `Bearer ${accessToken}` : null;

  const refreshDocs = useCallback(async () => {
    if (!orgId || !projectId) return;
    const list = await apiFetch<DocRow[]>(
      `/organizations/${orgId}/projects/${projectId}/documents`
    );
    setDocs(list);
  }, [orgId, projectId]);

  useEffect(() => {
    refreshDocs().catch((e) => setError(e.message));
  }, [refreshDocs]);

  const loadDetail = useCallback(
    async (documentId: string) => {
      if (!orgId) return;
      const d = await apiFetch<DocDetail>(`/organizations/${orgId}/documents/${documentId}`);
      setDetail(d);
      setActiveId(documentId);
      setPageIndex(0);
    },
    [orgId]
  );

  // Poll while processing
  useEffect(() => {
    if (!activeId || !detail) return;
    if (detail.processingStatus === "ready") return;
    const t = setInterval(() => {
      loadDetail(activeId).catch(() => undefined);
    }, 1500);
    return () => clearInterval(t);
  }, [activeId, detail?.processingStatus, loadDetail]);

  const activePage = detail?.pages?.[pageIndex] ?? null;

  useEffect(() => {
    if (!orgId || !activeId || !activePage || activePage.processingStatus !== "ready") {
      setTilePrefix(null);
      setText(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const meta = await apiFetch<{ tilePrefix: string; textKey: string }>(
        `/organizations/${orgId}/documents/${activeId}/pages/${activePage.id}/tiles`
      );
      if (cancelled) return;
      setTilePrefix(meta.tilePrefix);
      const textRes = await fetch(
        `/api/storage/object/${encodeURIComponent(meta.textKey)}`,
        {
          headers: authHeader ? { Authorization: authHeader } : {},
          credentials: "include",
        }
      );
      if (textRes.ok) {
        setText(await textRes.json());
      }
    })().catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [orgId, activeId, activePage?.id, activePage?.processingStatus, authHeader]);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId || !projectId) return;
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus("Uploading…");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await apiFetch<{ documentId: string }>(
        `/organizations/${orgId}/projects/${projectId}/documents/upload`,
        { method: "POST", body }
      );
      setStatus("Processing tiles…");
      await refreshDocs();
      await loadDetail(res.documentId);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const searchHits = useMemo(() => {
    if (!search || !text) return 0;
    const q = search.toLowerCase();
    return text.spans.filter((s) => s.text.toLowerCase().includes(q)).length;
  }, [search, text]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <Link className="text-sm font-semibold text-blue-600" to={`/orgs/${orgId}`}>
          ← Organization
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Project drawings</h1>
        <form onSubmit={onUpload} className="ml-auto flex items-center gap-2">
          <input
            type="file"
            name="file"
            accept="application/pdf"
            className="text-sm"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Working…" : "Upload PDF"}
          </button>
        </form>
      </div>
      {(error || status) && (
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-2 text-sm">
          {error && <span className="text-red-600">{error}</span>}
          {!error && status && <span className="text-slate-600">{status}</span>}
          {detail && (
            <span className="ml-3 text-slate-500">
              Status: <strong>{detail.processingStatus}</strong> · {detail.pageCount} pages
            </span>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
          <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Documents
          </p>
          <ul className="space-y-1">
            {docs.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => loadDetail(d.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    activeId === d.id ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="font-medium truncate">{d.filename}</div>
                  <div className="text-xs text-slate-500">
                    {d.processingStatus}
                    {d.pageCount ? ` · ${d.pageCount}p` : ""}
                  </div>
                </button>
              </li>
            ))}
            {!docs.length && (
              <li className="text-sm text-slate-500">Upload a PDF to get started.</li>
            )}
          </ul>
          {detail?.pages?.length ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pages
              </p>
              <div className="flex flex-wrap gap-1">
                {detail.pages.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPageIndex(i)}
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      i === pageIndex ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {p.pageNumber}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          </div>
          <div className="border-t border-slate-200 p-3">
            <FeatureFlagGate flag="markup_engine">
              <MarkupListPanel
                orgId={orgId || ""}
                revisionId={detail?.currentRevisionId ?? null}
              />
            </FeatureFlagGate>
          </div>
        </aside>
        <main className="relative min-w-0 flex-1">
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 shadow">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search text…"
              className="w-48 border-0 bg-transparent text-sm outline-none"
            />
            {search && (
              <span className="text-xs text-slate-500">{searchHits} hits</span>
            )}
            <span className="text-xs text-slate-400">V pan · wheel zoom</span>
          </div>
          {activePage && tilePrefix && activePage.processingStatus === "ready" ? (
            <TileViewport
              widthPts={activePage.widthPts}
              heightPts={activePage.heightPts}
              tilePrefix={tilePrefix}
              authHeader={authHeader}
              searchQuery={search}
              textSpans={text?.spans}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-100 text-slate-500">
              {detail?.processingStatus === "processing"
                ? "Generating tile pyramid…"
                : "Select or upload a document"}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
