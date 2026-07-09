import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";

const pointSchema = z.object({ x: z.number(), y: z.number() });
const geometrySchema = z.object({ points: z.array(pointSchema).min(1).max(10000) });

const createSchema = z.object({
  sheetId: z.string(),
  conditionId: z.string(),
  geometry: geometrySchema,
  computedValue: z.number(),
  source: z.enum(["manual", "ai"]).default("manual"),
});

export const POST = apiHandler(async (req) => {
  const userId = await requireUserId();
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return json({ error: "Invalid measurement" }, 400);
  const { sheetId, conditionId, geometry, computedValue, source } = parsed.data;

  const sheet = await prisma.sheet.findFirst({
    where: { id: sheetId, project: { userId } },
  });
  if (!sheet) return json({ error: "Sheet not found" }, 404);
  const condition = await prisma.condition.findFirst({
    where: { id: conditionId, projectId: sheet.projectId },
  });
  if (!condition) return json({ error: "Condition not found" }, 404);

  const measurement = await prisma.measurement.create({
    data: { sheetId, conditionId, geometry, computedValue, source },
  });
  return json(measurement);
});
