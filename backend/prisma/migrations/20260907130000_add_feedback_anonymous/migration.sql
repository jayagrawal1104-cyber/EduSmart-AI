-- AlterTable
-- Students can choose "Submit Anonymously" in the feedback form, but there was
-- no column to remember that choice — studentId was always set by the
-- controller regardless, so nothing was ever actually anonymous. This adds a
-- flag so the student can still see their own past submissions (studentId
-- stays set) while admin-facing views can hide the student's name whenever
-- anonymous = true.
ALTER TABLE `feedback`
  ADD COLUMN `anonymous` BOOLEAN NOT NULL DEFAULT false;