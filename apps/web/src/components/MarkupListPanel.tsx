import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

type MarkupRow = {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  layer: string | null;
  authorId: string | null;
  createdAt: string;
};

export default function MarkupListPanel({
  orgId,
  revisionId,
}: {
  orgId: string;
  revisionId: string | null;
}) {
  const query = useQuery({
    queryKey: ["markups", orgId, revisionId],
    enabled: Boolean(orgId && revisionId),
    queryFn: () =>
      apiFetch<MarkupRow[]>(`/organizations/${orgId}/revisions/${revisionId}/markups`),
  });

  if (!revisionId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Open a processed document to see the Markup List.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-bold text-slate-900">Markup List</h3>
        <p className="text-xs text-slate-500">Phase 2 scaffold — filter/export coming next</p>
      </div>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Subject</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Layer</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{m.type}</td>
                <td className="px-3 py-2 text-slate-600">{m.subject || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{m.status}</td>
                <td className="px-3 py-2 text-slate-600">{m.layer || "Default"}</td>
              </tr>
            ))}
            {!query.isLoading && !(query.data ?? []).length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  No markups yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
