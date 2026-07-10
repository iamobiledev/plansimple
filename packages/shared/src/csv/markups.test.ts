import { describe, it, expect } from "vitest";
import { filterMarkups, markupsToCsv } from "./markups.js";

const sample = [
  {
    id: "1",
    type: "cloud",
    status: "open",
    subject: "Wall conflict",
    layer: "Default",
    authorId: "a",
    pageNumber: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    type: "rectangle",
    status: "resolved",
    subject: "Door",
    layer: "Punch",
    authorId: "b",
    pageNumber: 2,
    createdAt: "2026-01-02T00:00:00.000Z",
  },
];

describe("filterMarkups", () => {
  it("filters by type and status", () => {
    expect(filterMarkups(sample, { type: "cloud" })).toHaveLength(1);
    expect(filterMarkups(sample, { status: "resolved" })[0]?.id).toBe("2");
  });

  it("filters by query against subject", () => {
    expect(filterMarkups(sample, { query: "door" })).toHaveLength(1);
  });
});

describe("markupsToCsv", () => {
  it("includes header and rows", () => {
    const csv = markupsToCsv(sample);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("Type");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("cloud");
  });
});
