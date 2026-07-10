import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type { DrawTool, MarkupStyle } from "../viewer/markupTypes";

type ToolItem = {
  id: string;
  name: string;
  shared: boolean;
  markupType: string;
  style: MarkupStyle;
  defaultSubject: string | null;
};

type Props = {
  orgId: string;
  currentTool: DrawTool;
  currentStyle: MarkupStyle;
  currentSubject: string;
  onApply: (tool: DrawTool, style: MarkupStyle, subject: string) => void;
};

export default function ToolChestPanel({
  orgId,
  currentTool,
  currentStyle,
  currentSubject,
  onApply,
}: Props) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["tool-chest", orgId],
    enabled: Boolean(orgId),
    queryFn: () => apiFetch<ToolItem[]>(`/organizations/${orgId}/tool-chest`),
  });

  const save = useMutation({
    mutationFn: async () => {
      const name = window.prompt("Tool name", currentSubject || currentTool);
      if (!name) return null;
      return apiFetch(`/organizations/${orgId}/tool-chest`, {
        method: "POST",
        json: {
          name,
          shared: true,
          markupType: currentTool === "pan" || currentTool === "select" ? "cloud" : currentTool,
          style: currentStyle,
          defaultSubject: currentSubject || undefined,
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tool-chest", orgId] }),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Tool Chest</h3>
        <button
          type="button"
          className="text-xs font-semibold text-blue-600"
          onClick={() => save.mutate()}
          disabled={currentTool === "pan" || currentTool === "select"}
        >
          Save current
        </button>
      </div>
      <ul className="max-h-40 space-y-1 overflow-auto">
        {(list.data ?? []).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50"
              onClick={() =>
                onApply(
                  item.markupType as DrawTool,
                  (item.style as MarkupStyle) || {},
                  item.defaultSubject || item.name
                )
              }
            >
              <div className="font-semibold text-slate-800">{item.name}</div>
              <div className="text-slate-500">
                {item.markupType}
                {item.shared ? " · shared" : ""}
              </div>
            </button>
          </li>
        ))}
        {!list.isLoading && !(list.data ?? []).length && (
          <li className="text-xs text-slate-400">Save a configured tool to reuse it.</li>
        )}
      </ul>
    </div>
  );
}
