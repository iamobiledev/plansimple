import { describe, it, expect } from "vitest";
import { rowsToCsv, buildSummary, summaryToCsv } from "./csv";
import type { Condition, Measurement, Sheet } from "../types";

const sheets: Sheet[] = [
  { id: "s1", projectId: "p", name: "A-101", pageNumber: 1, fileUrl: "", scalePixelsPerUnit: 20, unitSystem: "imperial" },
  { id: "s2", projectId: "p", name: "A-102", pageNumber: 2, fileUrl: "", scalePixelsPerUnit: 20, unitSystem: "imperial" },
];

const conditions: Condition[] = [
  { id: "c1", projectId: "p", name: "Drywall", color: "#ff0000", measurementType: "linear", unit: "LF", unitCost: 10, iconKey: null },
  { id: "c2", projectId: "p", name: "Receptacle", color: "#00ff00", measurementType: "count", unit: "EA", unitCost: null, iconKey: null },
];

function m(id: string, sheetId: string, conditionId: string, value: number): Measurement {
  return { id, sheetId, conditionId, geometry: { points: [] }, computedValue: value, source: "manual" };
}

describe("buildSummary", () => {
  it("sums quantities per condition per sheet and extends cost", () => {
    const lines = buildSummary(
      [m("1", "s1", "c1", 12.5), m("2", "s1", "c1", 7.5), m("3", "s2", "c1", 10), m("4", "s1", "c2", 1)],
      conditions,
      sheets
    );
    expect(lines).toHaveLength(3);
    const drywallS1 = lines.find((l) => l.conditionName === "Drywall" && l.sheetName === "A-101")!;
    expect(drywallS1.quantity).toBe(20);
    expect(drywallS1.extendedCost).toBe(200);
    const receptS1 = lines.find((l) => l.conditionName === "Receptacle")!;
    expect(receptS1.extendedCost).toBeNull();
  });

  it("skips measurements with missing condition or sheet", () => {
    const lines = buildSummary([m("1", "s1", "ghost", 5)], conditions, sheets);
    expect(lines).toHaveLength(0);
  });
});

describe("csv output", () => {
  it("escapes commas and quotes", () => {
    expect(rowsToCsv([["a,b", 'say "hi"', "plain"]])).toBe('"a,b","say ""hi""",plain\n');
  });

  it("renders a summary with header row", () => {
    const csv = summaryToCsv(
      buildSummary([m("1", "s1", "c1", 20)], conditions, sheets)
    );
    const rows = csv.trim().split("\n");
    expect(rows[0]).toBe("Condition,Sheet,Type,Quantity,Unit,Unit Cost,Extended Cost");
    expect(rows[1]).toBe("Drywall,A-101,linear,20,LF,10.00,200.00");
  });
});
