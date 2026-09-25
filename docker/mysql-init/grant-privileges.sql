-- Local dev only: give the app user full privileges on this MySQL server so
-- `prisma migrate dev` can create/drop its shadow database. Runs
-- automatically on first container init via /docker-entrypoint-initdb.d/.
GRANT ALL PRIVILEGES ON *.* TO 'campus'@'%';
FLUSH PRIVILEGES;