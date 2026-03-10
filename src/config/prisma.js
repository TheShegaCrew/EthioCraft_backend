const { PrismaClient } = require("@prisma/client");

const prisma = global.__ethiopianHandcraftPrisma || new PrismaClient({
  log: ["warn", "error"],
});

if (process.env.NODE_ENV !== "production") {
  global.__ethiopianHandcraftPrisma = prisma;
}

module.exports = prisma;
