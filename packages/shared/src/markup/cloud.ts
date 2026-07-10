/**
 * Cloud markup path generator — scalloped arcs along a polygon/polyline.
 * Matches Bluebeam-like cloud density for construction markups.
 */
import type { Point } from "../types.js";
import { distance } from "../geometry/index.js";

export type CloudOptions = {
  /** Arc radius in PDF points (default 8). */
  radius?: number;
  /** Arc sweep in radians (default ~4π/3 for classic cloud scallops). */
  sweep?: number;
  /** Sample points per scallop for polyline approximation. */
  samplesPerArc?: number;
};

/**
 * Build a closed cloud outline from polygon vertices (PDF points).
 * Returns a dense polyline suitable for SVG/Canvas stroke.
 */
export function cloudPathFromPolygon(vertices: Point[], opts: CloudOptions = {}): Point[] {
  if (vertices.length < 3) return [...vertices];
  const radius = opts.radius ?? 8;
  const sweep = opts.sweep ?? (Math.PI * 4) / 3;
  const samples = opts.samplesPerArc ?? 8;
  const out: Point[] = [];

  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    const len = distance(a, b);
    if (len < 1e-6) continue;
    const scallops = Math.max(1, Math.round(len / (radius * 1.6)));
    const dx = (b.x - a.x) / scallops;
    const dy = (b.y - a.y) / scallops;
    // Outward normal (left of edge direction for CCW polygons)
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;

    for (let s = 0; s < scallops; s++) {
      const sx = a.x + dx * s;
      const sy = a.y + dy * s;
      const ex = a.x + dx * (s + 1);
      const ey = a.y + dy * (s + 1);
      const mx = (sx + ex) / 2;
      const my = (sy + ey) / 2;
      // Arc center offset outward
      const cx = mx + nx * radius * 0.65;
      const cy = my + ny * radius * 0.65;
      const startAng = Math.atan2(sy - cy, sx - cx);
      for (let k = 0; k <= samples; k++) {
        const t = k / samples;
        const ang = startAng + sweep * t * (crossSign(a, b, { x: cx, y: cy }) >= 0 ? 1 : -1);
        // Simpler: semicircle-ish bulge using chord parametric
        const px = sx + (ex - sx) * t + nx * Math.sin(Math.PI * t) * radius;
        const py = sy + (ey - sy) * t + ny * Math.sin(Math.PI * t) * radius;
        void ang;
        out.push({ x: px, y: py });
      }
    }
  }
  return out;
}

function crossSign(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Approximate cloud bounding box. */
export function cloudBounds(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = points[0]!.x;
  let minY = points[0]!.y;
  let maxX = minX;
  let maxY = minY;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
