-- AlterTable
-- Mirrors Admin.sessionsInvalidatedAt / Student.sessionsInvalidatedAt: lets
-- "Sign out of all devices" on the faculty Settings page actually invalidate
-- previously-issued JWTs (enforced in auth.middleware.js).
ALTER TABLE `faculty`
  ADD COLUMN `sessionsInvalidatedAt` DATETIME(3) NULL;

-- CreateTable
-- One settings row per faculty member. Notification preferences, teaching
-- defaults, theme/language, and the 2FA toggle on the FacultySettings page
-- had nowhere to be saved before this — every value reset to its default on
-- refresh and "Save All Settings" was a no-op toast.
CREATE TABLE `faculty_settings` (
    `id` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,
    `notifyEmail` BOOLEAN NOT NULL DEFAULT true,
    `notifyPush` BOOLEAN NOT NULL DEFAULT true,
    `notifyAssignmentSubmissions` BOOLEAN NOT NULL DEFAULT true,
    `notifyAttendanceReminders` BOOLEAN NOT NULL DEFAULT true,
    `notifyLowAttendanceAlerts` BOOLEAN NOT NULL DEFAULT true,
    `notifyStudentFeedback` BOOLEAN NOT NULL DEFAULT false,
    `notifyNotices` BOOLEAN NOT NULL DEFAULT true,
    `attendanceMethod` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `defaultGradeScale` VARCHAR(191) NOT NULL DEFAULT 'percentage',
    `autoReminders` BOOLEAN NOT NULL DEFAULT true,
    `shareGradesWithStudents` BOOLEAN NOT NULL DEFAULT true,
    `theme` VARCHAR(191) NOT NULL DEFAULT 'light',
    `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `landingPage` VARCHAR(191) NOT NULL DEFAULT 'faculty/dashboard',
    `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `faculty_settings_facultyId_key`(`facultyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `faculty_settings` ADD CONSTRAINT `faculty_settings_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `faculty`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;