import { describe, it, expect } from "vitest";
import { cloudPathFromPolygon, cloudBounds } from "./cloud.js";

describe("cloudPathFromPolygon", () => {
  const rect = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 60 },
    { x: 0, y: 60 },
  ];

  it("returns empty-ish for degenerate input", () => {
    expect(cloudPathFromPolygon([])).toEqual([]);
    expect(cloudPathFromPolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toHaveLength(2);
  });

  it("produces more points than the source polygon", () => {
    const cloud = cloudPathFromPolygon(rect, { radius: 8 });
    expect(cloud.length).toBeGreaterThan(rect.length * 4);
  });

  it("stays roughly near the original bounds", () => {
    const cloud = cloudPathFromPolygon(rect, { radius: 10 });
    const b = cloudBounds(cloud);
    expect(b.minX).toBeLessThan(5);
    expect(b.minY).toBeLessThan(5);
    expect(b.maxX).toBeGreaterThan(95);
    expect(b.maxY).toBeGreaterThan(55);
    // Bulge expands outward a bit
    expect(b.minX).toBeLessThanOrEqual(0);
    expect(b.maxX).toBeGreaterThanOrEqual(100);
  });
});
