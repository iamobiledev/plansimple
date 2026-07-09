import { PrismaClient } from "@prisma/client";

// Reuse a single client across hot reloads in dev and across invocations in
// a warm serverless function.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prefer the Prisma-tuned pooled connection string when a managed Postgres
// integration (e.g. Neon on Vercel) provides one.
const datasourceUrl = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
