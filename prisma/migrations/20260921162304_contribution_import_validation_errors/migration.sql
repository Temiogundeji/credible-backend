-- AlterTable
ALTER TABLE "contribution_import_batches" ADD COLUMN     "validation_errors" JSONB NOT NULL DEFAULT '[]';
