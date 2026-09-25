/**
 * Prisma client singleton.
 * Import `prisma` anywhere you need to query the database:
 *   import { prisma } from '../config/db.js';
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buildDatabaseUrl } from './database-url.js';

// Prisma reads DATABASE_URL when the client is constructed below, so we
// assemble it from DB_HOST/DB_USER/DB_PASSWORD/DB_NAME first.
process.env.DATABASE_URL = buildDatabaseUrl();

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDB() {
  await prisma.$connect();
  console.log('Connected to MySQL via Prisma');
}

export async function disconnectDB() {
  await prisma.$disconnect();
}