import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsPanel({ orgId }: { orgId: string }) {
  const list = useQuery({
    queryKey: ["notifications", orgId],
    queryFn: () => apiFetch<Notification[]>(`/organizations/${orgId}/notifications`),
  });
  const digest = useQuery({
    queryKey: ["digest", orgId],
    queryFn: () =>
      apiFetch<{ subject: string; unreadCount: number }>(
        `/organizations/${orgId}/notifications/digest-preview`
      ),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
        <span className="text-[10px] text-slate-500">
          Digest: {digest.data?.unreadCount ?? 0} unread
        </span>
      </div>
      <ul className="max-h-28 space-y-1 overflow-auto text-xs">
        {(list.data ?? []).map((n) => (
          <li
            key={n.id}
            className={`rounded px-2 py-1 ${n.readAt ? "bg-slate-50 text-slate-500" : "bg-amber-50 text-slate-800"}`}
          >
            <div className="font-semibold">{n.title}</div>
            {n.body && <div className="text-slate-500">{n.body}</div>}
          </li>
        ))}
        {!list.isLoading && !(list.data ?? []).length && (
          <li className="text-slate-400">No notifications yet</li>
        )}
      </ul>
    </div>
  );
}
