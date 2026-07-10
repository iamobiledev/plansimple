import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useAuthStore } from "../store/auth";
import TileViewport from "../viewer/TileViewport";
import MarkupToolbar from "../viewer/MarkupToolbar";
import { FeatureFlagGate, useFeatureFlags } from "../components/FeatureFlags";
import MarkupListPanel from "../components/MarkupListPanel";
import ToolChestPanel from "../components/ToolChestPanel";
import AiPanel from "../components/AiPanel";
import WorkflowsPanel from "../components/WorkflowsPanel";
import NotificationsPanel from "../components/NotificationsPanel";
import { useCollabRoom } from "../viewer/useCollab";
import OverlayCompare from "../viewer/OverlayCompare";
import {
  DEFAULT_STYLE,
  type DrawTool,
  type Markup,
  type MarkupStyle,
} from "../viewer/markupTypes";

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
  scaleCalibration?: {
    pixelsPerUnit?: number;
    unit?: string;
    unitSystem?: string;
  } | null;
};

type DocDetail = DocRow & { pages: PageRow[] };

type TextLayer = {
  spans: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }>;
};

export default function ProjectPage() {
  const { orgId, projectId } = useParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const flags = useFeatureFlags();
  const markupEnabled = Boolean(flags.data?.markup_engine);
  const realtimeEnabled = Boolean(flags.data?.realtime_sessions);
  const measurementsEnabled = Boolean(flags.data?.measurements);
  const compareEnabled = Boolean(flags.data?.revision_compare);
  const aiEnabled = Boolean(
    flags.data?.ai_sheet_indexing || flags.data?.ai_nl_search || flags.data?.ai_rfi_draft
  );
  const workflowsEnabled = Boolean(flags.data?.workflows_rfi);
  const user = useAuthStore((s) => s.user);
  const [compareMode, setCompareMode] = useState(false);
  const [compareOpacity, setCompareOpacity] = useState(0.55);
  const [revisions, setRevisions] = useState<
    Array<{ id: string; versionNumber: number; processingStatus: string }>
  >([]);
  const [compareRevisionId, setCompareRevisionId] = useState<string | null>(null);

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
  const [tool, setTool] = useState<DrawTool>("pan");
  const [style, setStyle] = useState<MarkupStyle>(DEFAULT_STYLE);
  const [subject, setSubject] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "v" || e.key === "V") setTool("pan");
      if (e.key === "Escape") setTool("select");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!orgId || !activeId || !compareEnabled) {
      setRevisions([]);
      return;
    }
    apiFetch<Array<{ id: string; versionNumber: number; processingStatus: string }>>(
      `/organizations/${orgId}/documents/${activeId}/revisions`
    )
      .then((rows) => {
        setRevisions(rows);
        const older = rows.find((r) => r.id !== detail?.currentRevisionId);
        setCompareRevisionId(older?.id ?? null);
      })
      .catch(() => setRevisions([]));
  }, [orgId, activeId, compareEnabled, detail?.currentRevisionId]);

  async function uploadNewRevision(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId || !activeId) return;
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("revision") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      await apiFetch(`/organizations/${orgId}/documents/${activeId}/revisions/upload`, {
        method: "POST",
        body,
      });
      setStatus("New revision uploading / processing…");
      await refreshDocs();
      await loadDetail(activeId);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revision upload failed");
    } finally {
      setBusy(false);
    }
  }

  const loadDetail = useCallback(
    async (documentId: string) => {
      if (!orgId) return;
      const d = await apiFetch<DocDetail>(`/organizations/${orgId}/documents/${documentId}`);
      setDetail(d);
      setActiveId(documentId);
      setPageIndex(0);
      setSelectedId(null);
    },
    [orgId]
  );

  useEffect(() => {
    if (!activeId || !detail) return;
    if (detail.processingStatus === "ready") return;
    const t = setInterval(() => {
      loadDetail(activeId).catch(() => undefined);
    }, 1500);
    return () => clearInterval(t);
  }, [activeId, detail?.processingStatus, loadDetail]);

  const activePage = detail?.pages?.[pageIndex] ?? null;
  const revisionId = detail?.currentRevisionId ?? null;

  const markupsQuery = useQuery({
    queryKey: ["markups", orgId, revisionId],
    enabled: Boolean(orgId && revisionId && markupEnabled),
    queryFn: () =>
      apiFetch<Markup[]>(`/organizations/${orgId}/revisions/${revisionId}/markups`),
  });

  const roomName =
    orgId && revisionId ? `org:${orgId}:revision:${revisionId}` : null;
  const collab = useCollabRoom({
    enabled: Boolean(realtimeEnabled && roomName),
    roomName,
    user,
  });

  const pageMarkups = useMemo(() => {
    const byId = new Map<string, Markup>();
    for (const m of markupsQuery.data ?? []) {
      if (m.pageId === activePage?.id) byId.set(m.id, m);
    }
    for (const m of collab.remoteMarkups) {
      if (!activePage?.id || m.pageId === activePage.id) byId.set(m.id, m);
    }
    return Array.from(byId.values());
  }, [markupsQuery.data, collab.remoteMarkups, activePage?.id]);

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
      const textRes = await fetch(`/api/storage/object/${encodeURIComponent(meta.textKey)}`, {
        headers: authHeader ? { Authorization: authHeader } : {},
        credentials: "include",
      });
      if (textRes.ok) setText(await textRes.json());
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

  async function createMarkup(payload: {
    type: string;
    geometry: Record<string, unknown>;
    style: MarkupStyle;
    subject: string | null;
  }) {
    if (!orgId || !activePage || !revisionId) return;
    const me = useAuthStore.getState().user;
    const geometry = { ...payload.geometry };
    if (typeof geometry.text === "string") {
      geometry.text = geometry.text
        .replaceAll("{{user}}", me?.email || me?.name || "user")
        .replaceAll("{{date}}", new Date().toISOString().slice(0, 10))
        .replaceAll("{{status}}", "open");
    }
    await apiFetch(`/organizations/${orgId}/markups`, {
      method: "POST",
      json: {
        pageId: activePage.id,
        revisionId,
        type: payload.type,
        geometry,
        style: payload.style,
        subject: payload.subject,
        layer: "Default",
        status: "open",
      },
    }).then((created) => {
      const row = created as Markup;
      collab.publishMarkup({
        ...row,
        pageId: activePage.id,
        revisionId,
        type: payload.type,
        geometry,
        style: payload.style,
        subject: payload.subject,
        status: "open",
        layer: "Default",
        authorId: user?.id ?? null,
        createdAt: new Date().toISOString(),
      });
    });
    await qc.invalidateQueries({ queryKey: ["markups", orgId, revisionId] });
  }

  function downloadExport(mode: "original" | "annotations" | "flattened") {
    if (!orgId || !activeId || !accessToken) return;
    const url = `/api/organizations/${orgId}/documents/${activeId}/export?mode=${mode}`;
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error("Export failed");
        const blob = await r.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${detail?.filename || "export"}-${mode}.pdf`;
        a.click();
      })
      .catch((e) => setError(e.message));
  }

  async function onCalibrate(points: [{ x: number; y: number }, { x: number; y: number }]) {
    if (!orgId || !activePage) return;
    const raw = window.prompt("Real-world length (e.g. 20'-0\" or 5m)", "20'-0\"");
    if (!raw) return;
    // Prefer imperial parse when feet marks present
    let unit: "ft" | "m" | "in" | "mm" = "ft";
    let realWorldDistance = 20;
    try {
      const { parseLengthInput } = await import("@plansimple/shared");
      if (/m|mm|cm/i.test(raw) && !/'|"|ft/.test(raw)) {
        unit = /mm/i.test(raw) ? "mm" : "m";
        realWorldDistance = parseLengthInput(raw, "metric");
        if (unit === "m") {
          /* already meters */
        }
      } else {
        unit = "ft";
        realWorldDistance = parseLengthInput(raw, "imperial");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid length");
      return;
    }
    try {
      await apiFetch(`/organizations/${orgId}/pages/${activePage.id}/calibration`, {
        method: "PATCH",
        json: { points, realWorldDistance, unit },
      });
      if (activeId) await loadDetail(activeId);
      await qc.invalidateQueries({ queryKey: ["markups", orgId, revisionId] });
      setStatus("Page calibrated");
      setTool("length");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calibration failed");
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
          {activeId && detail?.processingStatus === "ready" && (
            <div className="mr-2 flex gap-1">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => downloadExport("original")}
              >
                Export original
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => downloadExport("annotations")}
              >
                Export +markups
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => downloadExport("flattened")}
              >
                Export flattened
              </button>
            </div>
          )}
          <input type="file" name="file" accept="application/pdf" className="text-sm" disabled={busy} />
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
      {markupEnabled && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
          <MarkupToolbar
            tool={tool}
            onTool={setTool}
            style={style}
            onStyle={setStyle}
            subject={subject}
            onSubject={setSubject}
          />
          {measurementsEnabled && activePage?.scaleCalibration?.pixelsPerUnit && (
            <p className="mt-1 text-xs text-emerald-700">
              Calibrated · {activePage.scaleCalibration.pixelsPerUnit.toFixed(2)} pts/
              {activePage.scaleCalibration.unit || "ft"}
            </p>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
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
                    <div className="truncate font-medium">{d.filename}</div>
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
            {compareEnabled && activeId && (
              <div className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Revisions
                </p>
                <ul className="space-y-1 text-xs text-slate-600">
                  {revisions.map((r) => (
                    <li key={r.id}>
                      v{r.versionNumber} · {r.processingStatus}
                      {r.id === detail?.currentRevisionId ? " · current" : ""}
                    </li>
                  ))}
                </ul>
                <form onSubmit={uploadNewRevision} className="space-y-1">
                  <input type="file" name="revision" accept="application/pdf" className="w-full text-xs" />
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                  >
                    Upload new revision
                  </button>
                </form>
                {revisions.length > 1 && (
                  <>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={compareMode}
                        onChange={(e) => setCompareMode(e.target.checked)}
                      />
                      Overlay compare
                    </label>
                    {compareMode && (
                      <label className="block text-xs text-slate-600">
                        Opacity
                        <input
                          type="range"
                          min={0.1}
                          max={0.9}
                          step={0.05}
                          value={compareOpacity}
                          onChange={(e) => setCompareOpacity(Number(e.target.value))}
                          className="w-full"
                        />
                      </label>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 p-3 space-y-3">
            {orgId && <NotificationsPanel orgId={orgId} />}
            {workflowsEnabled && orgId && projectId && (
              <WorkflowsPanel orgId={orgId} projectId={projectId} />
            )}
            {aiEnabled && orgId && projectId && (
              <AiPanel
                orgId={orgId}
                projectId={projectId}
                documentId={activeId}
                onOpenPage={(docId, pageNumber) => {
                  void loadDetail(docId).then(() => setPageIndex(Math.max(0, pageNumber - 1)));
                }}
              />
            )}
            <FeatureFlagGate flag="markup_engine">
              <ToolChestPanel
                orgId={orgId || ""}
                currentTool={tool}
                currentStyle={style}
                currentSubject={subject}
                onApply={(t, s, sub) => {
                  setTool(t);
                  setStyle({ ...DEFAULT_STYLE, ...s });
                  setSubject(sub);
                }}
              />
              <MarkupListPanel
                orgId={orgId || ""}
                revisionId={revisionId}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChanged={() =>
                  qc.invalidateQueries({ queryKey: ["markups", orgId, revisionId] })
                }
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
            {search && <span className="text-xs text-slate-500">{searchHits} hits</span>}
            <span className="text-xs text-slate-400">V pan · Esc select · wheel zoom</span>
            {realtimeEnabled && (
              <span
                className={`text-xs font-semibold ${
                  collab.connected ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {collab.connected ? `Live · ${collab.peers.length} peer(s)` : "Connecting…"}
              </span>
            )}
          </div>
          {realtimeEnabled && collab.peers.length > 0 && (
            <div className="absolute right-3 top-3 z-10 flex gap-1">
              {collab.peers.map((p) => (
                <span
                  key={p.clientId}
                  className="rounded-full px-2 py-1 text-[10px] font-bold text-white"
                  style={{ background: p.color }}
                  title={p.name}
                >
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
              ))}
            </div>
          )}
          {activePage && tilePrefix && activePage.processingStatus === "ready" ? (
            compareMode && compareRevisionId && orgId && activeId ? (
              <div className="h-full overflow-auto p-4">
                <OverlayCompare
                  baseTilePrefix={`orgs/${orgId}/documents/${activeId}/revisions/${compareRevisionId}/pages/${activePage.pageNumber}`}
                  overlayTilePrefix={tilePrefix}
                  widthPts={activePage.widthPts}
                  heightPts={activePage.heightPts}
                  authHeader={authHeader}
                  opacity={compareOpacity}
                />
              </div>
            ) : (
            <TileViewport
              widthPts={activePage.widthPts}
              heightPts={activePage.heightPts}
              tilePrefix={tilePrefix}
              authHeader={authHeader}
              searchQuery={search}
              textSpans={text?.spans}
              markups={markupEnabled ? pageMarkups : []}
              tool={markupEnabled ? tool : "pan"}
              style={style}
              subject={subject}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreateMarkup={markupEnabled ? createMarkup : undefined}
              onCalibrate={measurementsEnabled ? onCalibrate : undefined}
            />
            )
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
