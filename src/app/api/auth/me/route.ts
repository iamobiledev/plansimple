import { prisma } from "@/server/db";
import { getSession } from "@/server/session";
import { apiHandler, json } from "@/server/http";

export const GET = apiHandler(async () => {
  const session = await getSession();
  if (!session.userId) return json({ user: null });
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  });
  return json({ user });
});
