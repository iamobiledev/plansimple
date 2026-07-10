/**
 * Pure geometry math for takeoff measurements.
 *
 * Points are in PDF page coordinate space (PDF points at scale 1, or
 * equivalent sheet pixels). Conversion to real-world units lives in scale/.
 */
import type { Point, MeasurementType } from "../types.js";

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Total length of an open polyline. */
export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    total += distance(prev, curr);
  }
  return total;
}

/** Area of a simple polygon via the shoelace formula. Always non-negative. */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Perimeter of a closed polygon (includes the closing edge). */
export function polygonPerimeter(points: Point[]): number {
  if (points.length < 2) return 0;
  return polylineLength(points) + distance(points[points.length - 1]!, points[0]!);
}

/** Centroid of a polygon (falls back to vertex average for degenerate shapes). */
export function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const area2 = points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length]!;
    return sum + (a.x * b.y - b.x * a.y);
  }, 0);
  if (Math.abs(area2) < 1e-9) {
    const n = points.length;
    return {
      x: points.reduce((s, p) => s + p.x, 0) / n,
      y: points.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Raw pixel-space quantity of a measurement:
 *  - linear → polyline length in px
 *  - area   → polygon area in px²
 *  - count  → number of marker points
 */
export function pixelQuantity(type: MeasurementType, points: Point[]): number {
  switch (type) {
    case "linear":
      return polylineLength(points);
    case "area":
      return polygonArea(points);
    case "count":
      return points.length;
  }
}
