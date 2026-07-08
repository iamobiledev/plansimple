import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

router.post("/register", async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash } });
    req.session.userId = user.id;
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = z
      .object({ email: z.string().email(), password: z.string() })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    req.session.userId = user.id;
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/me", async (req, res, next) => {
  try {
    if (!req.session.userId) return res.json({ user: null });
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, email: true },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
