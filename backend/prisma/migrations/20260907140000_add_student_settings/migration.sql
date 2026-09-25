-- AlterTable
-- Mirrors Admin.sessionsInvalidatedAt: lets "Sign out of all devices" on the
-- student Settings page actually invalidate previously-issued JWTs (enforced
-- in auth.middleware.js), instead of just being a UI button that does nothing.
ALTER TABLE `students`
  ADD COLUMN `sessionsInvalidatedAt` DATETIME(3) NULL;

-- CreateTable
-- One settings row per student. Notification preferences, theme/language and
-- the 2FA toggle on the student Settings page had nowhere to be saved before
-- this — every value reset to its default on refresh.
CREATE TABLE `student_settings` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `notifyEmail` BOOLEAN NOT NULL DEFAULT true,
    `notifyPush` BOOLEAN NOT NULL DEFAULT true,
    `notifyAssignments` BOOLEAN NOT NULL DEFAULT true,
    `notifyAttendance` BOOLEAN NOT NULL DEFAULT true,
    `notifyNotices` BOOLEAN NOT NULL DEFAULT false,
    `theme` VARCHAR(191) NOT NULL DEFAULT 'light',
    `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `student_settings_studentId_key`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `student_settings` ADD CONSTRAINT `student_settings_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;