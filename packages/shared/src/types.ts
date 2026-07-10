/** Shared domain primitives used by geometry / scale / csv helpers. */

export type UnitSystem = "imperial" | "metric";
export type MeasurementType = "linear" | "area" | "count";
export type MeasurementSource = "manual" | "ai";

export interface Point {
  x: number;
  y: number;
}

/** Lightweight shapes for CSV summary helpers (Phase 0/4). */
export interface SheetRef {
  id: string;
  name: string;
}

export interface ConditionRef {
  id: string;
  name: string;
  measurementType: MeasurementType;
  unit: string;
  unitCost: number | null;
}

export interface MeasurementRef {
  id: string;
  sheetId: string;
  conditionId: string;
  computedValue: number;
  source: MeasurementSource;
  geometry: { points: Point[] };
}
