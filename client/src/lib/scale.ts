/**
 * Scale calibration and unit conversion — pure functions, no UI.
 *
 * A sheet's scale is stored as `pixelsPerUnit`: how many sheet pixels equal
 * one base unit. Base units: feet (imperial) or meters (metric).
 */
import type { MeasurementType, UnitSystem } from "../types";

/** pixels-per-unit from a calibration line of `pixelDistance` px over `realLength` base units. */
export function computePixelsPerUnit(pixelDistance: number, realLength: number): number {
  if (pixelDistance <= 0 || realLength <= 0) {
    throw new Error("Calibration requires positive distances");
  }
  return pixelDistance / realLength;
}

/** Convert a pixel length to base units (ft or m). */
export function pixelsToLength(pixels: number, pixelsPerUnit: number): number {
  return pixels / pixelsPerUnit;
}

/** Convert a pixel² area to base units² (sq ft or m²). */
export function pixelsToArea(pixelsSquared: number, pixelsPerUnit: number): number {
  return pixelsSquared / (pixelsPerUnit * pixelsPerUnit);
}

/**
 * Convert a raw pixel-space quantity (from geometry.pixelQuantity) into
 * real-world units. Counts pass through unchanged and need no calibration.
 */
export function toRealQuantity(
  type: MeasurementType,
  pixelValue: number,
  pixelsPerUnit: number | null
): number {
  if (type === "count") return pixelValue;
  if (!pixelsPerUnit || pixelsPerUnit <= 0) {
    throw new Error("Sheet is not calibrated");
  }
  return type === "linear"
    ? pixelsToLength(pixelValue, pixelsPerUnit)
    : pixelsToArea(pixelValue, pixelsPerUnit);
}

/**
 * Parse a user-entered real-world length into base units.
 *
 * Imperial (returns feet): `20`, `20'`, `20'-6"`, `20' 6"`, `20ft`, `6"`, `20.5`
 * Metric (returns meters): `5`, `5m`, `2.4`, `250mm`, `35cm`
 */
export function parseLengthInput(input: string, unitSystem: UnitSystem): number {
  const s = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) throw new Error("Enter a length");

  if (unitSystem === "metric") {
    const m = s.match(/^([\d.]+)\s*(mm|cm|m)?$/);
    if (!m) throw new Error(`Could not parse "${input}" — try formats like 5, 5m, 250mm`);
    const value = parseFloat(m[1]);
    if (!isFinite(value)) throw new Error("Invalid number");
    switch (m[2]) {
      case "mm":
        return value / 1000;
      case "cm":
        return value / 100;
      default:
        return value;
    }
  }

  // Imperial. Try feet-and-inches first: 20'-6", 20' 6", 20'6"
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*'\s*[- ]?\s*(\d+(?:\.\d+)?)\s*(?:"|in)?$/);
  if (ftIn) {
    return parseFloat(ftIn[1]) + parseFloat(ftIn[2]) / 12;
  }
  // Inches only: 6", 6in
  const inches = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inches)$/);
  if (inches) {
    return parseFloat(inches[1]) / 12;
  }
  // Feet: 20, 20', 20ft, 20.5
  const feet = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)?$/);
  if (feet) {
    const value = parseFloat(feet[1]);
    if (!isFinite(value)) throw new Error("Invalid number");
    return value;
  }
  throw new Error(`Could not parse "${input}" — try formats like 20, 20'-6", or 6"`);
}

/** Format a base-unit length for display: 12'-6" (imperial) or 3.81 m (metric). */
export function formatLength(value: number, unitSystem: UnitSystem): string {
  if (unitSystem === "metric") {
    return `${round(value, 2)} m`;
  }
  const totalInches = Math.round(value * 12);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return inches === 0 ? `${feet}'-0"` : `${feet}'-${inches}"`;
}

/** Format a base-unit² area for display: 1,250 SF or 24.5 m². */
export function formatArea(value: number, unitSystem: UnitSystem): string {
  if (unitSystem === "metric") {
    return `${round(value, 2).toLocaleString()} m²`;
  }
  return `${round(value, 1).toLocaleString()} SF`;
}

/** Format a measurement quantity by type. */
export function formatQuantity(
  type: MeasurementType,
  value: number,
  unitSystem: UnitSystem
): string {
  switch (type) {
    case "linear":
      return formatLength(value, unitSystem);
    case "area":
      return formatArea(value, unitSystem);
    case "count":
      return String(Math.round(value));
  }
}

/** Default takeoff unit label for a condition of the given type. */
export function defaultUnit(type: MeasurementType, unitSystem: UnitSystem): string {
  switch (type) {
    case "linear":
      return unitSystem === "metric" ? "m" : "LF";
    case "area":
      return unitSystem === "metric" ? "m²" : "SF";
    case "count":
      return "EA";
  }
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
