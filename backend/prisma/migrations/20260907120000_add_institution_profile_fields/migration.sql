-- AlterTable
-- Institution profile fields: these were already read/written by
-- institution.controller.js (getInstitutionProfile / updateInstitutionProfile)
-- and rendered by the AdminInstitution page, but the columns never existed,
-- so every institution showed "—" for all of them and PATCH /admin/institution
-- would fail. This adds the missing columns as nullable so existing rows are
-- unaffected.
ALTER TABLE `institutions`
  ADD COLUMN `type` VARCHAR(191) NULL,
  ADD COLUMN `address` VARCHAR(191) NULL,
  ADD COLUMN `state` VARCHAR(191) NULL,
  ADD COLUMN `email` VARCHAR(191) NULL,
  ADD COLUMN `phone` VARCHAR(191) NULL,
  ADD COLUMN `website` VARCHAR(191) NULL,
  ADD COLUMN `accreditation` VARCHAR(191) NULL,
  ADD COLUMN `establishedYear` INTEGER NULL;