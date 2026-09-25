-- CreateTable
CREATE TABLE `periodic_tests` (
    `id` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` ENUM('UNIT_TEST', 'CLASS_TEST', 'MID_SEMESTER', 'QUIZ') NOT NULL,
    `totalMarks` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `time` VARCHAR(191) NULL,
    `venue` VARCHAR(191) NULL,
    `syllabus` TEXT NULL,
    `section` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `periodic_test_results` (
    `id` VARCHAR(191) NOT NULL,
    `testId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `marksObtained` INTEGER NULL,
    `missed` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `periodic_test_results_testId_studentId_key`(`testId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `periodic_tests` ADD CONSTRAINT `periodic_tests_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `faculty`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `periodic_tests` ADD CONSTRAINT `periodic_tests_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `periodic_test_results` ADD CONSTRAINT `periodic_test_results_testId_fkey` FOREIGN KEY (`testId`) REFERENCES `periodic_tests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `periodic_test_results` ADD CONSTRAINT `periodic_test_results_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
