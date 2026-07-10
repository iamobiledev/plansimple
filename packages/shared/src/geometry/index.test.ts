import { describe, it, expect } from "vitest";
import {
  distance,
  polylineLength,
  polygonArea,
  polygonPerimeter,
  polygonCentroid,
  pixelQuantity,
} from "./index.js";

describe("distance", () => {
  it("computes euclidean distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("is zero for identical points", () => {
    expect(distance({ x: 7, y: -2 }, { x: 7, y: -2 })).toBe(0);
  });
});

describe("polylineLength", () => {
  it("returns 0 for fewer than two points", () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 1, y: 1 }])).toBe(0);
  });

  it("sums segment lengths", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ];
    expect(polylineLength(points)).toBe(15);
  });

  it("does not close the polyline", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polylineLength(points)).toBe(30);
  });
});

describe("polygonArea", () => {
  it("returns 0 for degenerate polygons", () => {
    expect(polygonArea([])).toBe(0);
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ])
    ).toBe(0);
  });

  it("computes a rectangle area", () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polygonArea(rect)).toBe(200);
  });

  it("is orientation-independent", () => {
    const cw = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 0 },
    ];
    expect(polygonArea(cw)).toBe(200);
  });

  it("computes a triangle area", () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 6 },
    ];
    expect(polygonArea(tri)).toBe(30);
  });

  it("handles an L-shaped (concave) polygon", () => {
    const el = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polygonArea(el)).toBe(75);
  });
});

describe("polygonPerimeter", () => {
  it("includes the closing edge", () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polygonPerimeter(rect)).toBe(60);
  });
});

describe("polygonCentroid", () => {
  it("finds the center of a rectangle", () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ];
    const c = polygonCentroid(rect);
    expect(c.x).toBeCloseTo(10);
    expect(c.y).toBeCloseTo(5);
  });
});

describe("pixelQuantity", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 40 },
  ];

  it("dispatches linear to polyline length", () => {
    expect(pixelQuantity("linear", pts)).toBe(70);
  });

  it("dispatches area to polygon area", () => {
    expect(pixelQuantity("area", pts)).toBe(600);
  });

  it("dispatches count to point count", () => {
    expect(pixelQuantity("count", pts)).toBe(3);
  });
});
