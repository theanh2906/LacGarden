import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to apps/web/.env or set DATABASE_URL before using database-backed pages.");
  }

  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
