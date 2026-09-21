-- CreateEnum
CREATE TYPE "ContributionImportStatus" AS ENUM ('uploaded', 'validating', 'ready', 'committed', 'rejected');

-- CreateEnum
CREATE TYPE "ContributionImportRowStatus" AS ENUM ('pending', 'valid', 'invalid', 'committed');

-- CreateTable
CREATE TABLE "contribution_import_batches" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "content_hash" VARCHAR(128) NOT NULL,
    "status" "ContributionImportStatus" NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "committed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribution_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_import_rows" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "contributor_reference" VARCHAR(100) NOT NULL,
    "collection_date" DATE NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "payment_method" "ContributionPaymentMethod" NOT NULL,
    "book_entry_reference" VARCHAR(150) NOT NULL,
    "status" "ContributionImportRowStatus" NOT NULL,
    "error_code" VARCHAR(80),
    "error_message" VARCHAR(500),
    "raw" JSONB NOT NULL,
    "contribution_id" UUID,

    CONSTRAINT "contribution_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contribution_import_batches_agency_id_status_created_at_idx" ON "contribution_import_batches"("agency_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "contribution_import_batches_agency_id_content_hash_key" ON "contribution_import_batches"("agency_id", "content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "contribution_import_rows_contribution_id_key" ON "contribution_import_rows"("contribution_id");

-- CreateIndex
CREATE INDEX "contribution_import_rows_batch_id_status_idx" ON "contribution_import_rows"("batch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contribution_import_rows_batch_id_row_number_key" ON "contribution_import_rows"("batch_id", "row_number");

-- AddForeignKey
ALTER TABLE "contribution_import_batches" ADD CONSTRAINT "contribution_import_batches_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_import_batches" ADD CONSTRAINT "contribution_import_batches_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_import_batches" ADD CONSTRAINT "contribution_import_batches_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_import_rows" ADD CONSTRAINT "contribution_import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "contribution_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_import_rows" ADD CONSTRAINT "contribution_import_rows_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
