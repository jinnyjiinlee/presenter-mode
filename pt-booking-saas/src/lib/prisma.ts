import { PrismaClient } from "@prisma/client";

// dev 에서 HMR 로 PrismaClient 가 여러 번 생성되는 것을 방지하기 위한 싱글턴.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
