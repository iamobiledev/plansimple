import { describe, it, expect } from "vitest";
import {
  computePixelsPerUnit,
  toRealQuantity,
  parseLengthInput,
} from "./index.js";
import { distance, polygonArea } from "../geometry/index.js";

/**
 * Acceptance: calibrate a floor plan, measure a known room, within 0.5% of truth.
 * Synthetic: 20'-0" calibration over 400 PDF points → 20 pts/ft.
 * Room 20' x 15' = 300 SF drawn as 400x300 pt rectangle.
 */
describe("measurement accuracy (Phase 4)", () => {
  it("measures known room within 0.5%", () => {
    const realLength = parseLengthInput("20'-0\"", "imperial");
    const ppu = computePixelsPerUnit(400, realLength);
    expect(ppu).toBe(20);

    const room = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 300 },
      { x: 0, y: 300 },
    ];
    const areaPx = polygonArea(room);
    const areaSf = toRealQuantity("area", areaPx, ppu);
    const truth = 20 * 15; // 300 SF
    const err = Math.abs(areaSf - truth) / truth;
    expect(err).toBeLessThan(0.005);

    const wall = distance(room[0]!, room[1]!);
    const wallFt = toRealQuantity("linear", wall, ppu);
    expect(Math.abs(wallFt - 20) / 20).toBeLessThan(0.005);
  });
});
