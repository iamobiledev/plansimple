import { FormEvent, useState } from "react";
import { apiFetch } from "../lib/api";

type SearchHit = {
  sheetNumber?: string;
  pageId?: string;
  pageNumber?: number;
  documentId?: string;
  score?: number;
  snippet?: string;
};

export default function AiPanel({
  orgId,
  projectId,
  documentId,
  onOpenPage,
}: {
  orgId: string;
  projectId: string;
  documentId: string | null;
  onOpenPage?: (documentId: string, pageNumber: number) => void;
}) {
  const [query, setQuery] = useState("roof drain");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [indexResult, setIndexResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ results: SearchHit[] }>(
        `/organizations/${orgId}/projects/${projectId}/ai/search`,
        { method: "POST", json: { query } }
      );
      setHits(res.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function runIndex() {
    if (!documentId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ pages: Array<{ pageNumber: number; sheetNumber?: string; confidence?: number }> }>(
        `/organizations/${orgId}/documents/${documentId}/ai/sheet-index`,
        { method: "POST" }
      );
      setIndexResult(
        `Indexed ${res.pages.length} pages` +
          (res.pages[0]?.sheetNumber ? ` · e.g. ${res.pages[0].sheetNumber}` : "")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Indexing failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-violet-950">AI assist</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
          Verify me
        </span>
      </div>
      <button
        type="button"
        disabled={!documentId || busy}
        onClick={() => void runIndex()}
        className="mb-2 w-full rounded-lg bg-violet-700 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        Index sheet titles
      </button>
      {indexResult && <p className="mb-2 text-xs text-violet-800">{indexResult}</p>}
      <form onSubmit={runSearch} className="space-y-1">
        <input
          className="w-full rounded border border-violet-200 px-2 py-1 text-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask: where are the roof drains?"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg border border-violet-300 bg-white px-2 py-1 text-xs font-semibold text-violet-800"
        >
          Search drawings
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
        {hits.map((h, i) => (
          <li key={i}>
            <button
              type="button"
              className="w-full rounded-lg bg-white/80 px-2 py-1.5 text-left text-xs hover:bg-white"
              onClick={() => {
                if (h.documentId && h.pageNumber && onOpenPage) {
                  onOpenPage(h.documentId, h.pageNumber);
                }
              }}
            >
              <div className="font-semibold text-slate-800">
                {h.sheetNumber || "Sheet"}{" "}
                <span className="font-normal text-slate-500">
                  ({Math.round((h.score || 0) * 100)}%)
                </span>
              </div>
              <div className="line-clamp-2 text-slate-500">{h.snippet}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
