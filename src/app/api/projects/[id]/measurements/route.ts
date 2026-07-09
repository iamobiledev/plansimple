import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

// All measurements across the project (for the quantity summary).
export const GET = apiHandler<Ctx>(async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!project) return json({ error: "Project not found" }, 404);
  const measurements = await prisma.measurement.findMany({
    where: { sheet: { projectId: project.id } },
    orderBy: { createdAt: "asc" },
  });
  return json(measurements);
});
