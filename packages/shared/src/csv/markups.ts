import type { MarkupType, MarkupStatus } from "../schemas/markups.js";
import { rowsToCsv } from "./index.js";

export type MarkupListItem = {
  id: string;
  type: MarkupType | string;
  status: MarkupStatus | string;
  subject: string | null;
  layer: string | null;
  authorId: string | null;
  pageId?: string;
  pageNumber?: number;
  createdAt: string;
};

export type MarkupListFilters = {
  type?: string;
  status?: string;
  layer?: string;
  authorId?: string;
  pageId?: string;
  query?: string;
};

export function filterMarkups(
  items: MarkupListItem[],
  filters: MarkupListFilters
): MarkupListItem[] {
  const q = filters.query?.trim().toLowerCase();
  return items.filter((m) => {
    if (filters.type && m.type !== filters.type) return false;
    if (filters.status && m.status !== filters.status) return false;
    if (filters.layer && (m.layer || "Default") !== filters.layer) return false;
    if (filters.authorId && m.authorId !== filters.authorId) return false;
    if (filters.pageId && m.pageId !== filters.pageId) return false;
    if (q) {
      const hay = `${m.subject ?? ""} ${m.type} ${m.status} ${m.layer ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function markupsToCsv(items: MarkupListItem[]): string {
  const rows: Array<Array<string | number>> = [
    ["Id", "Type", "Status", "Subject", "Layer", "Page", "Author", "Created At"],
  ];
  for (const m of items) {
    rows.push([
      m.id,
      m.type,
      m.status,
      m.subject ?? "",
      m.layer ?? "Default",
      m.pageNumber ?? m.pageId ?? "",
      m.authorId ?? "",
      m.createdAt,
    ]);
  }
  return rowsToCsv(rows);
}
