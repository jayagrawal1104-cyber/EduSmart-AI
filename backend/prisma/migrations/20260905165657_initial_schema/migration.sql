-- CreateTable
CREATE TABLE `institutions` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'TRIAL', 'SUSPENDED') NOT NULL DEFAULT 'TRIAL',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `institutions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL DEFAULT 'trial',
    `seats` INTEGER NOT NULL DEFAULT 0,
    `renewsAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `subscriptions_institutionId_key`(`institutionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `super_admins` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `super_admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admins` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admins_institutionId_email_key`(`institutionId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `departments_institutionId_code_key`(`institutionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `courses` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `courses_institutionId_code_key`(`institutionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faculty` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `joinedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `faculty_institutionId_email_key`(`institutionId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `rollId` VARCHAR(191) NULL,
    `year` INTEGER NOT NULL,
    `section` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `enrolledDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `students_institutionId_email_key`(`institutionId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignments` (
    `id` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `totalMarks` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submissions` (
    `id` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SUBMITTED', 'GRADED', 'LATE') NOT NULL DEFAULT 'PENDING',
    `marks` INTEGER NULL,
    `submittedAt` DATETIME(3) NULL,

    UNIQUE INDEX `submissions_assignmentId_studentId_key`(`assignmentId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE') NOT NULL,
    `markedById` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `attendance_studentId_subjectId_date_key`(`studentId`, `subjectId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `performance_records` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timetable_slots` (
    `id` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `subjectName` VARCHAR(191) NOT NULL,
    `room` VARCHAR(191) NULL,
    `section` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_plans` (
    `id` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,
    `subjectName` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `scheduledFor` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notices` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
    `audience` VARCHAR(191) NOT NULL,
    `publishDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiryDate` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedback` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NULL,
    `facultyId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `rating` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `join_requests` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NULL,
    `rollId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `requestedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `institutionId` VARCHAR(191) NOT NULL,
    `userLabel` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `device` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Success',
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admins` ADD CONSTRAINT `admins_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faculty` ADD CONSTRAINT `faculty_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faculty` ADD CONSTRAINT `faculty_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `faculty`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `faculty`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `assignments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_markedById_fkey` FOREIGN KEY (`markedById`) REFERENCES `faculty`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `performance_records` ADD CONSTRAINT `performance_records_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timetable_slots` ADD CONSTRAINT `timetable_slots_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `faculty`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `faculty`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notices` ADD CONSTRAINT `notices_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notices` ADD CONSTRAINT `notices_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `faculty`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `join_requests` ADD CONSTRAINT `join_requests_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
