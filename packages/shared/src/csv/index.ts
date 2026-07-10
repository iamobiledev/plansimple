/**
 * Quantity-summary CSV export — pure functions, no UI.
 */
import type { ConditionRef, MeasurementRef, SheetRef } from "../types.js";

function escapeCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: Array<Array<string | number>>): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\n") + "\n";
}

export interface SummaryLine {
  conditionName: string;
  sheetName: string;
  measurementType: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  extendedCost: number | null;
}

/**
 * Build per-condition-per-sheet summary lines from raw measurements.
 * `quantity` sums each measurement's computedValue (already in real units).
 */
export function buildSummary(
  measurements: MeasurementRef[],
  conditions: ConditionRef[],
  sheets: SheetRef[]
): SummaryLine[] {
  const conditionById = new Map(conditions.map((c) => [c.id, c]));
  const sheetById = new Map(sheets.map((s) => [s.id, s]));
  const totals = new Map<string, number>();

  for (const m of measurements) {
    const key = `${m.conditionId}|${m.sheetId}`;
    totals.set(key, (totals.get(key) ?? 0) + m.computedValue);
  }

  const lines: SummaryLine[] = [];
  for (const [key, quantity] of totals) {
    const [conditionId, sheetId] = key.split("|");
    const condition = conditionById.get(conditionId!);
    const sheet = sheetById.get(sheetId!);
    if (!condition || !sheet) continue;
    const extendedCost = condition.unitCost != null ? quantity * condition.unitCost : null;
    lines.push({
      conditionName: condition.name,
      sheetName: sheet.name,
      measurementType: condition.measurementType,
      quantity,
      unit: condition.unit,
      unitCost: condition.unitCost,
      extendedCost,
    });
  }
  lines.sort(
    (a, b) => a.conditionName.localeCompare(b.conditionName) || a.sheetName.localeCompare(b.sheetName)
  );
  return lines;
}

export function summaryToCsv(lines: SummaryLine[]): string {
  const rows: Array<Array<string | number>> = [
    ["Condition", "Sheet", "Type", "Quantity", "Unit", "Unit Cost", "Extended Cost"],
  ];
  for (const line of lines) {
    rows.push([
      line.conditionName,
      line.sheetName,
      line.measurementType,
      Math.round(line.quantity * 100) / 100,
      line.unit,
      line.unitCost != null ? line.unitCost.toFixed(2) : "",
      line.extendedCost != null ? line.extendedCost.toFixed(2) : "",
    ]);
  }
  return rowsToCsv(rows);
}

export * from "./markups.js";
