-- AlterTable
-- The FacultyResources page shows a short description per resource, but the
-- column never existed. Nullable so existing admin-uploaded rows are fine.
ALTER TABLE `resources`
  ADD COLUMN `description` TEXT NULL;