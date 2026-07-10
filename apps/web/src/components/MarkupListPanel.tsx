import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { filterMarkups, markupsToCsv } from "@plansimple/shared";
import { apiFetch } from "../lib/api";
import type { Markup } from "../viewer/markupTypes";

type Props = {
  orgId: string;
  revisionId: string | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChanged?: () => void;
};

export default function MarkupListPanel({
  orgId,
  revisionId,
  selectedId,
  onSelect,
  onChanged,
}: Props) {
  const qc = useQueryClient();
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  const listQuery = useQuery({
    queryKey: ["markups", orgId, revisionId],
    enabled: Boolean(orgId && revisionId),
    queryFn: () =>
      apiFetch<Markup[]>(`/organizations/${orgId}/revisions/${revisionId}/markups`),
  });

  const filtered = useMemo(
    () =>
      filterMarkups(
        (listQuery.data ?? []).map((m) => ({
          id: m.id,
          type: m.type,
          status: m.status,
          subject: m.subject,
          layer: m.layer,
          authorId: m.authorId,
          pageId: m.pageId,
          createdAt: m.createdAt,
        })),
        { type: type || undefined, status: status || undefined, query: query || undefined }
      ),
    [listQuery.data, type, status, query]
  );

  const bulk = useMutation({
    mutationFn: (payload: { ids: string[]; status: string }) =>
      apiFetch(`/organizations/${orgId}/markups/bulk-status`, {
        method: "POST",
        json: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["markups", orgId, revisionId] });
      onChanged?.();
    },
  });

  function exportCsv() {
    const csv = markupsToCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "markups.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!revisionId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Open a processed document to see the Markup List.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">Markup List</h3>
          <button
            type="button"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          <input
            className="col-span-3 rounded border border-slate-200 px-2 py-1 text-xs"
            placeholder="Filter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="rounded border border-slate-200 px-1 py-1 text-xs"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {[
              "rectangle",
              "ellipse",
              "line",
              "arrow",
              "polyline",
              "polygon",
              "cloud",
              "cloud_callout",
              "freehand",
              "highlighter",
              "textbox",
              "callout",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-slate-200 px-1 py-1 text-xs"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All status</option>
            {["open", "in_review", "resolved", "void"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded bg-slate-100 px-1 py-1 text-xs font-semibold text-slate-700"
            disabled={!selectedId}
            onClick={() =>
              selectedId && bulk.mutate({ ids: [selectedId], status: "resolved" })
            }
          >
            Resolve
          </button>
        </div>
      </div>
      <div className="max-h-56 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Subject</th>
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.id}
                className={`cursor-pointer border-t border-slate-100 ${
                  selectedId === m.id ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
                onClick={() => onSelect?.(m.id)}
              >
                <td className="px-3 py-2 font-medium text-slate-800">{m.type}</td>
                <td className="px-3 py-2 text-slate-600">{m.subject || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{m.status}</td>
              </tr>
            ))}
            {!listQuery.isLoading && !filtered.length && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                  No markups yet — pick a tool and draw
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
