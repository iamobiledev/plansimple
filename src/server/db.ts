import { PrismaClient } from "@prisma/client";

// Reuse a single client across hot reloads in dev and across invocations in
// a warm serverless function.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
