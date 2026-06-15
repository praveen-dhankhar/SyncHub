import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import prismaPkg from "@prisma/client";
const { PrismaClient } = prismaPkg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Missing DATABASE_URL environment variable. " +
    "Copy backend/.env.example to backend/.env and fill in your database URL."
  );
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

export { prisma }