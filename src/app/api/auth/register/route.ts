import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { getSession } from "@/server/session";
import { apiHandler, json } from "@/server/http";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const POST = apiHandler(async (req) => {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return json({ error: parsed.error.errors[0].message }, 400);
  }
  const { email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return json({ error: "An account with that email already exists" }, 409);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  return json({ id: user.id, email: user.email });
});
