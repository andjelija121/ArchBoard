import { PrismaPg } from "@prisma/adapter-pg";
import { withAccelerate } from "@prisma/extension-accelerate";

import { PrismaClient } from "./generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

// Both branches are exposed as a plain `PrismaClient`. The Accelerate
// extension only adds an optional `cacheStrategy` query option, and typing the
// export as a union of the two client shapes makes every model method
// uncallable (TS2349).
const createPrismaClient = (): PrismaClient => {
  if (databaseUrl.startsWith("prisma+postgres://")) {
    return new PrismaClient({ accelerateUrl: databaseUrl }).$extends(
      withAccelerate(),
    ) as unknown as PrismaClient;
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
