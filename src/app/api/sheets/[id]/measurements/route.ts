import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler<Ctx>(async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const sheet = await prisma.sheet.findFirst({
    where: { id, project: { userId } },
    select: { id: true },
  });
  if (!sheet) return json({ error: "Sheet not found" }, 404);
  const measurements = await prisma.measurement.findMany({
    where: { sheetId: sheet.id },
    orderBy: { createdAt: "asc" },
  });
  return json(measurements);
});
