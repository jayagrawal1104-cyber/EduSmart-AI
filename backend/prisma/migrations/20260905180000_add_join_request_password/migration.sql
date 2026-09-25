-- AlterTable
-- Stores the password the person chose on the join-institution form, hashed,
-- so an admin's approval can create the real Student/Faculty account without
-- a separate "set your password" step.
ALTER TABLE `join_requests` ADD COLUMN `passwordHash` VARCHAR(191) NOT NULL DEFAULT '';