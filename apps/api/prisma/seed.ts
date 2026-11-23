import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.info("[seed] Running AddisGebeya database seed foundation...");
  await prisma.$connect();
  console.info("[seed] Database connection verified. No seed records configured yet.");
}

main()
  .catch((error: unknown) => {
    console.error("[seed] Seed execution failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
