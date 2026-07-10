import { describe, it, expect } from "vitest";
import {
  computePixelsPerUnit,
  pixelsToLength,
  pixelsToArea,
  toRealQuantity,
  parseLengthInput,
  formatLength,
  formatArea,
  defaultUnit,
} from "./index.js";

describe("computePixelsPerUnit", () => {
  it("divides pixel distance by real length", () => {
    expect(computePixelsPerUnit(400, 20)).toBe(20);
  });

  it("rejects non-positive inputs", () => {
    expect(() => computePixelsPerUnit(0, 20)).toThrow();
    expect(() => computePixelsPerUnit(400, 0)).toThrow();
    expect(() => computePixelsPerUnit(-5, 10)).toThrow();
  });
});

describe("pixelsToLength / pixelsToArea", () => {
  it("converts lengths", () => {
    expect(pixelsToLength(100, 20)).toBe(5);
  });

  it("converts areas with squared scale", () => {
    expect(pixelsToArea(4000, 20)).toBe(10);
  });
});

describe("toRealQuantity", () => {
  it("converts linear quantities", () => {
    expect(toRealQuantity("linear", 100, 20)).toBe(5);
  });

  it("converts area quantities", () => {
    expect(toRealQuantity("area", 4000, 20)).toBe(10);
  });

  it("passes counts through without calibration", () => {
    expect(toRealQuantity("count", 7, null)).toBe(7);
  });

  it("throws for linear/area on an uncalibrated sheet", () => {
    expect(() => toRealQuantity("linear", 100, null)).toThrow(/not calibrated/);
    expect(() => toRealQuantity("area", 100, 0)).toThrow(/not calibrated/);
  });
});

describe("parseLengthInput — imperial (returns feet)", () => {
  it.each([
    ["20", 20],
    ["20'", 20],
    ["20ft", 20],
    ["20.5", 20.5],
    ["20'-6\"", 20.5],
    ["20' 6\"", 20.5],
    ["20'6\"", 20.5],
    ["6\"", 0.5],
    ["6in", 0.5],
  ])("parses %s as %d ft", (input, expected) => {
    expect(parseLengthInput(input, "imperial")).toBeCloseTo(expected);
  });

  it("rejects garbage", () => {
    expect(() => parseLengthInput("abc", "imperial")).toThrow();
    expect(() => parseLengthInput("", "imperial")).toThrow();
  });
});

describe("parseLengthInput — metric (returns meters)", () => {
  it.each([
    ["5", 5],
    ["5m", 5],
    ["2.4", 2.4],
    ["250mm", 0.25],
    ["35cm", 0.35],
  ])("parses %s as %d m", (input, expected) => {
    expect(parseLengthInput(input, "metric")).toBeCloseTo(expected);
  });

  it("rejects imperial notation in metric mode", () => {
    expect(() => parseLengthInput("20'-6\"", "metric")).toThrow();
  });
});

describe("formatting", () => {
  it("formats imperial lengths as feet-inches", () => {
    expect(formatLength(20.5, "imperial")).toBe("20'-6\"");
    expect(formatLength(10, "imperial")).toBe("10'-0\"");
  });

  it("rolls inches over correctly when rounding", () => {
    expect(formatLength(9.999, "imperial")).toBe("10'-0\"");
  });

  it("formats metric lengths", () => {
    expect(formatLength(3.456, "metric")).toBe("3.46 m");
  });

  it("formats areas", () => {
    expect(formatArea(1250.04, "imperial")).toBe("1,250 SF");
    expect(formatArea(24.526, "metric")).toBe("24.53 m²");
  });
});

describe("defaultUnit", () => {
  it("matches type and unit system", () => {
    expect(defaultUnit("linear", "imperial")).toBe("LF");
    expect(defaultUnit("area", "metric")).toBe("m²");
    expect(defaultUnit("count", "imperial")).toBe("EA");
  });
});

describe("end-to-end scale scenario", () => {
  it("calibrates then measures a wall", () => {
    const realLength = parseLengthInput("20'-0\"", "imperial");
    const ppu = computePixelsPerUnit(400, realLength);
    expect(ppu).toBe(20);
    expect(toRealQuantity("linear", 510, ppu)).toBeCloseTo(25.5);
    expect(formatLength(25.5, "imperial")).toBe("25'-6\"");
  });
});
