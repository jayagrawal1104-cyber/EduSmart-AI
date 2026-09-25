-- AlterTable
ALTER TABLE `admins` ADD COLUMN `sessionsInvalidatedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `resources` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `type` ENUM('SYLLABUS', 'NOTES', 'VIDEO', 'QUESTION_PAPER', 'REFERENCE') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `fileUrl` TEXT NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileSizeBytes` INTEGER NOT NULL,
    `uploadedByLabel` VARCHAR(191) NOT NULL,
    `uploadedByRole` VARCHAR(191) NOT NULL,
    `uploadedByAdminId` VARCHAR(191) NULL,
    `uploadedByFacultyId` VARCHAR(191) NULL,
    `downloads` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `institution_settings` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `academicYear` VARCHAR(191) NOT NULL DEFAULT '2026',
    `defaultGradeScale` VARCHAR(191) NOT NULL DEFAULT 'percentage',
    `attendanceThreshold` INTEGER NOT NULL DEFAULT 75,
    `landingPage` VARCHAR(191) NOT NULL DEFAULT 'admin/dashboard',
    `notifyEmail` BOOLEAN NOT NULL DEFAULT true,
    `notifyPush` BOOLEAN NOT NULL DEFAULT true,
    `notifyJoinRequests` BOOLEAN NOT NULL DEFAULT true,
    `notifyLowAttendance` BOOLEAN NOT NULL DEFAULT true,
    `notifyAtRiskFlags` BOOLEAN NOT NULL DEFAULT true,
    `notifyWorkloadAlerts` BOOLEAN NOT NULL DEFAULT true,
    `notifyWeeklyDigest` BOOLEAN NOT NULL DEFAULT true,
    `theme` VARCHAR(191) NOT NULL DEFAULT 'light',
    `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'ist',
    `twoFactorRequired` BOOLEAN NOT NULL DEFAULT false,
    `sessionTimeoutMinutes` INTEGER NOT NULL DEFAULT 30,
    `qrLoginEnabled` BOOLEAN NOT NULL DEFAULT true,
    `joinApprovalRequired` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `institution_settings_institutionId_key`(`institutionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generated_reports` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `type` ENUM('ATTENDANCE', 'PERFORMANCE', 'ASSIGNMENT', 'WORKLOAD', 'RISK', 'DEPARTMENT', 'FEEDBACK') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `format` VARCHAR(191) NOT NULL,
    `fileUrl` TEXT NOT NULL,
    `fileSizeBytes` INTEGER NOT NULL,
    `generatedByLabel` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `resources` ADD CONSTRAINT `resources_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resources` ADD CONSTRAINT `resources_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resources` ADD CONSTRAINT `resources_uploadedByAdminId_fkey` FOREIGN KEY (`uploadedByAdminId`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resources` ADD CONSTRAINT `resources_uploadedByFacultyId_fkey` FOREIGN KEY (`uploadedByFacultyId`) REFERENCES `faculty`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `institution_settings` ADD CONSTRAINT `institution_settings_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generated_reports` ADD CONSTRAINT `generated_reports_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
