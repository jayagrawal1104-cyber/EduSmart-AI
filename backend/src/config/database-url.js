/**
 * Builds the MySQL connection string Prisma needs from separate
 * DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME variables, so the .env
 * file can stay in the simple multi-field format instead of one connection
 * URL. DB_PORT defaults to 3306 if not set.
 */
export function buildDatabaseUrl() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DATABASE_URL } = process.env;

  // If someone sets DATABASE_URL directly, respect it instead.
  if (DATABASE_URL) return DATABASE_URL;

  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error(
      'Missing DB_HOST, DB_USER or DB_NAME in .env — copy .env.example to .env and fill them in.'
    );
  }

  const user = encodeURIComponent(DB_USER);
  const password = encodeURIComponent(DB_PASSWORD || '');
  const port = DB_PORT || '3306';

  return `mysql://${user}:${password}@${DB_HOST}:${port}/${DB_NAME}`;
}