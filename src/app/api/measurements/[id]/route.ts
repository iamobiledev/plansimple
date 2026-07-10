import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

const pointSchema = z.object({ x: z.number(), y: z.number() });
const geometrySchema = z.object({ points: z.array(pointSchema).min(1).max(10000) });

const patchSchema = z.object({
  geometry: geometrySchema.optional(),
  computedValue: z.number().optional(),
  conditionId: z.string().optional(),
});

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const measurement = await prisma.measurement.findFirst({
    where: { id, sheet: { project: { userId } } },
    include: { sheet: true },
  });
  if (!measurement) return json({ error: "Measurement not found" }, 404);
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return json({ error: "Invalid measurement update" }, 400);
  if (parsed.data.conditionId) {
    const condition = await prisma.condition.findFirst({
      where: { id: parsed.data.conditionId, projectId: measurement.sheet.projectId },
    });
    if (!condition) return json({ error: "Condition not found" }, 404);
  }
  const updated = await prisma.measurement.update({
    where: { id: measurement.id },
    data: parsed.data,
  });
  return json(updated);
});

export const DELETE = apiHandler<Ctx>(async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const measurement = await prisma.measurement.findFirst({
    where: { id, sheet: { project: { userId } } },
  });
  if (!measurement) return json({ error: "Measurement not found" }, 404);
  await prisma.measurement.delete({ where: { id: measurement.id } });
  return json({ ok: true });
});
