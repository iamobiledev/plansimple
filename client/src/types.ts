export type UnitSystem = "imperial" | "metric";
export type MeasurementType = "linear" | "area" | "count";
export type MeasurementSource = "manual" | "ai";

export interface User {
  id: string;
  email: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  _count?: { sheets: number };
}

export interface Sheet {
  id: string;
  projectId: string;
  name: string;
  pageNumber: number;
  fileUrl: string;
  scalePixelsPerUnit: number | null;
  unitSystem: UnitSystem;
}

export interface Condition {
  id: string;
  projectId: string;
  name: string;
  color: string;
  measurementType: MeasurementType;
  unit: string;
  unitCost: number | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface Measurement {
  id: string;
  sheetId: string;
  conditionId: string;
  geometry: { points: Point[] };
  computedValue: number;
  source: MeasurementSource;
}

export interface ProjectDetail extends Project {
  sheets: Sheet[];
  conditions: Condition[];
}

export type Tool =
  | "select"
  | "pan"
  | "calibrate"
  | "linear"
  | "area"
  | "count"
  | "ai-count"
  | "ai-area";
