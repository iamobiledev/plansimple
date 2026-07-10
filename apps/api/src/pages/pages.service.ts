import { Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import {
  computePixelsPerUnit,
  distance,
  polygonArea,
  polylineLength,
  toRealQuantity,
} from "@plansimple/shared";
import { DatabaseService } from "../db/database.service";
import { pages, markups, auditLog } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";

export type CalibrateInput = {
  points: [{ x: number; y: number }, { x: number; y: number }];
  realWorldDistance: number;
  unit: "ft" | "m" | "in" | "mm";
};

@Injectable()
export class PagesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orgs: OrgsService
  ) {}

  async calibrate(
    organizationId: string,
    pageId: string,
    userId: string,
    input: CalibrateInput
  ) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);
    const pixelDistance = distance(input.points[0], input.points[1]);
    // Store calibration; pixelsPerUnit derived from PDF points / real units
    const real =
      input.unit === "in"
        ? input.realWorldDistance / 12
        : input.unit === "mm"
          ? input.realWorldDistance / 1000
          : input.realWorldDistance;
    const unitNormalized = input.unit === "in" || input.unit === "ft" ? "ft" : "m";
    const pixelsPerUnit = computePixelsPerUnit(pixelDistance, real);
    const calibration = {
      points: input.points,
      realWorldDistance: real,
      unit: (unitNormalized === "ft" ? "ft" : "m") as "ft" | "m",
      pixelsPerUnit,
      unitSystem: unitNormalized === "ft" ? "imperial" : "metric",
    };

    return this.db.withTenant(organizationId, userId, async (db) => {
      const pageRows = await db
        .select()
        .from(pages)
        .where(and(eq(pages.id, pageId), eq(pages.organizationId, organizationId)));
      const page = pageRows[0];
      if (!page) throw new NotFoundException("Page not found");

      await db
        .update(pages)
        .set({ scaleCalibration: calibration })
        .where(eq(pages.id, pageId));

      // Recalculate measurement markups on this page
      const pageMarkups = await db
        .select()
        .from(markups)
        .where(and(eq(markups.pageId, pageId), eq(markups.organizationId, organizationId)));

      for (const m of pageMarkups) {
        if (!["length", "polylength", "area", "perimeter", "count"].includes(m.type)) continue;
        const measurement = this.computeMeasurement(m.type, m.geometry as Record<string, unknown>, pixelsPerUnit, unitNormalized);
        if (!measurement) continue;
        await db
          .update(markups)
          .set({ measurement, updatedAt: new Date() })
          .where(eq(markups.id, m.id));
      }

      await db.insert(auditLog).values({
        organizationId,
        actorId: userId,
        action: "page.calibrate",
        entityType: "page",
        entityId: pageId,
        after: calibration,
      });

      return { ...page, scaleCalibration: calibration };
    });
  }

  computeMeasurement(
    type: string,
    geometry: Record<string, unknown>,
    pixelsPerUnit: number | null,
    unitSystem: "ft" | "m"
  ) {
    const points = Array.isArray(geometry.points)
      ? (geometry.points as Array<{ x: number; y: number }>)
      : geometry.x1 != null
        ? [
            { x: Number(geometry.x1), y: Number(geometry.y1) },
            { x: Number(geometry.x2), y: Number(geometry.y2) },
          ]
        : [];

    if (type === "count") {
      const n = points.length || Number(geometry.count ?? 1);
      return {
        kind: "count" as const,
        rawValue: n,
        calibratedValue: n,
        unit: "EA",
      };
    }

    let raw = 0;
    let kind: "length" | "area" = "length";
    if (type === "area") {
      raw = polygonArea(points);
      kind = "area";
    } else if (type === "perimeter") {
      raw = polylineLength(points) + (points.length > 2 ? distance(points[0]!, points[points.length - 1]!) : 0);
      kind = "length";
    } else {
      raw = polylineLength(points);
      kind = "length";
    }

    const calibrated =
      pixelsPerUnit && pixelsPerUnit > 0
        ? toRealQuantity(kind === "area" ? "area" : "linear", raw, pixelsPerUnit)
        : null;

    return {
      kind,
      rawValue: raw,
      calibratedValue: calibrated,
      unit: kind === "area" ? (unitSystem === "ft" ? "SF" : "m²") : unitSystem === "ft" ? "LF" : "m",
    };
  }
}
