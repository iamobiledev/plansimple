import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(300).nullable().optional(),
  clientName: z.string().max(200).nullable().optional(),
});

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) return json({ error: "Project not found" }, 404);
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return json({ error: "Invalid project update" }, 400);
  const updated = await prisma.project.update({ where: { id: project.id }, data: parsed.data });
  return json(updated);
});

export const GET = apiHandler<Ctx>(async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: {
      sheets: { orderBy: [{ createdAt: "asc" }, { pageNumber: "asc" }] },
      conditions: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) return json({ error: "Project not found" }, 404);
  return json(project);
});

export const DELETE = apiHandler<Ctx>(async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) return json({ error: "Project not found" }, 404);
  await prisma.project.delete({ where: { id: project.id } });
  return json({ ok: true });
});
