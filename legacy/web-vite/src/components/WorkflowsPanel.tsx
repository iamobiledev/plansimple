import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

type Rfi = {
  id: string;
  number: string;
  title: string;
  status: string;
  body: string | null;
};

export default function WorkflowsPanel({
  orgId,
  projectId,
}: {
  orgId: string;
  projectId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("RFI-002");
  const list = useQuery({
    queryKey: ["rfis", orgId, projectId],
    queryFn: () =>
      apiFetch<Rfi[]>(`/organizations/${orgId}/projects/${projectId}/rfis`),
  });

  async function create(e: FormEvent) {
    e.preventDefault();
    await apiFetch(`/organizations/${orgId}/projects/${projectId}/rfis`, {
      method: "POST",
      json: { number, title, body: "" },
    });
    setTitle("");
    await qc.invalidateQueries({ queryKey: ["rfis", orgId, projectId] });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-bold text-slate-900">RFIs</h3>
      <form onSubmit={create} className="mb-2 flex gap-1">
        <input
          className="w-20 rounded border px-1 text-xs"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <input
          className="flex-1 rounded border px-1 text-xs"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <button type="submit" className="rounded bg-slate-900 px-2 text-xs font-semibold text-white">
          Add
        </button>
      </form>
      <ul className="max-h-32 space-y-1 overflow-auto text-xs">
        {(list.data ?? []).map((r) => (
          <li key={r.id} className="rounded bg-slate-50 px-2 py-1">
            <span className="font-semibold">{r.number}</span> · {r.title}{" "}
            <span className="text-slate-400">({r.status})</span>
          </li>
        ))}
        {!list.isLoading && !(list.data ?? []).length && (
          <li className="text-slate-400">No RFIs yet</li>
        )}
      </ul>
    </div>
  );
}
