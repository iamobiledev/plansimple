import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

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
