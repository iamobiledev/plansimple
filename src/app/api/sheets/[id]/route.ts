import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";
import { storage } from "@/server/storage";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  scalePixelsPerUnit: z.number().positive().nullable().optional(),
  unitSystem: z.enum(["imperial", "metric"]).optional(),
});

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const sheet = await prisma.sheet.findFirst({
    where: { id, project: { userId } },
  });
  if (!sheet) return json({ error: "Sheet not found" }, 404);
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return json({ error: "Invalid sheet update" }, 400);
  const updated = await prisma.sheet.update({ where: { id: sheet.id }, data: parsed.data });
  return json(updated);
});

export const DELETE = apiHandler<Ctx>(async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const sheet = await prisma.sheet.findFirst({
    where: { id, project: { userId } },
  });
  if (!sheet) return json({ error: "Sheet not found" }, 404);
  await prisma.sheet.delete({ where: { id: sheet.id } });
  const key = sheet.fileUrl.split("/").pop();
  if (key) await storage.delete(key).catch(() => {});
  return json({ ok: true });
});
