-- CreateEnum
CREATE TYPE "ContributorObligationStatus" AS ENUM ('scheduled', 'overdue', 'partial', 'paid', 'credited');

-- CreateTable
CREATE TABLE "contributor_obligations" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "contributor_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "expected_amount_minor" BIGINT NOT NULL,
    "paid_amount_minor" BIGINT NOT NULL DEFAULT 0,
    "outstanding_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "ContributorObligationStatus" NOT NULL,
    "policy_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributor_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contributor_obligations_agency_id_contributor_id_due_date_idx" ON "contributor_obligations"("agency_id", "contributor_id", "due_date");

-- CreateIndex
CREATE INDEX "contributor_obligations_agency_id_status_due_date_idx" ON "contributor_obligations"("agency_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "contributor_obligations_plan_id_due_date_key" ON "contributor_obligations"("plan_id", "due_date");

-- AddForeignKey
ALTER TABLE "contributor_obligations" ADD CONSTRAINT "contributor_obligations_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_obligations" ADD CONSTRAINT "contributor_obligations_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "contributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_obligations" ADD CONSTRAINT "contributor_obligations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "contributor_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
