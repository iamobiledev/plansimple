import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withBypass } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/server/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ message: "Validation failed" }, { status: 400 });
  }
  const email = body.data.email.toLowerCase();

  const rows = await withBypass(async (db) =>
    db.select().from(users).where(eq(users.email, email)).limit(1)
  );
  const user = rows[0];
  if (!user?.passwordHash) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }
  const ok = await bcrypt.compare(body.data.password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
