-- AlterTable
-- Session type for a timetable slot, used to color-code the weekly grid
-- (Lecture / Tutorial / Lab). Defaults to "Lecture" so every existing row
-- stays valid without a backfill.
ALTER TABLE `timetable_slots`
  ADD COLUMN `type` VARCHAR(191) NOT NULL DEFAULT 'Lecture';