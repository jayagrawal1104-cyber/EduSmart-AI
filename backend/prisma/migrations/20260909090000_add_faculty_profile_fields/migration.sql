-- AlterTable
-- Faculty profile fields backing the FacultyProfile page's "Personal
-- Information" / "Academic Details" sections, editable via PUT /faculty/profile.
ALTER TABLE `faculty`
  ADD COLUMN `phone` VARCHAR(191) NULL,
  ADD COLUMN `qualifications` VARCHAR(191) NULL,
  ADD COLUMN `specialization` VARCHAR(191) NULL,
  ADD COLUMN `officeHours` VARCHAR(191) NULL,
  ADD COLUMN `officeRoom` VARCHAR(191) NULL;

-- AlterTable
-- `markedAt` records when attendance was recorded, separate from `date`
-- (the class date), so activity feeds can order by real recency.
ALTER TABLE `attendance`
  ADD COLUMN `markedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `faculty_certifications` (
  `id` VARCHAR(191) NOT NULL,
  `facultyId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `issuer` VARCHAR(191) NOT NULL,
  `year` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `faculty_certifications`
  ADD CONSTRAINT `faculty_certifications_facultyId_fkey`
  FOREIGN KEY (`facultyId`) REFERENCES `faculty`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;