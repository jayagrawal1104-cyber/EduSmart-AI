-- AlterTable
-- Faculty can now belong to a course (e.g. "B.Tech CSE"), same as students —
-- optional since existing faculty rows and admin-created ones may not set it.
ALTER TABLE `faculty`
  ADD COLUMN `courseId` VARCHAR(191) NULL;

-- AlterTable
-- Captured on the public join form itself: the course a faculty applicant
-- belongs to, and the subjects they teach (free text, comma-separated).
-- Copied onto the real Faculty/Subject rows when the request is approved.
ALTER TABLE `join_requests`
  ADD COLUMN `courseId` VARCHAR(191) NULL,
  ADD COLUMN `subjects` TEXT NULL;

-- CreateIndex
CREATE INDEX `faculty_courseId_idx` ON `faculty`(`courseId`);

-- AddForeignKey
ALTER TABLE `faculty`
  ADD CONSTRAINT `faculty_courseId_fkey`
  FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;