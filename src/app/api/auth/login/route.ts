import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { getSession } from "@/server/session";
import { apiHandler, json } from "@/server/http";

const schema = z.object({ email: z.string().email(), password: z.string() });

export const POST = apiHandler(async (req) => {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return json({ error: "Invalid credentials" }, 400);
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return json({ error: "Invalid email or password" }, 401);
  }
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  return json({ id: user.id, email: user.email });
});
