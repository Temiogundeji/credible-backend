-- CreateEnum
CREATE TYPE "ContributorStatus" AS ENUM ('invited', 'pending_verification', 'active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "ContributorPlanFrequency" AS ENUM ('daily', 'weekly');

-- CreateEnum
CREATE TYPE "ContributorPlanStatus" AS ENUM ('draft', 'active', 'suspended', 'superseded');

-- CreateTable
CREATE TABLE "contributors" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "reference_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "next_of_kin" JSONB,
    "kyc_reference" TEXT,
    "status" "ContributorStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributor_assignments" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "contributor_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributor_plans" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "contributor_id" UUID NOT NULL,
    "frequency" "ContributorPlanFrequency" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "target_minor" BIGINT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "ContributorPlanStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributor_invitations" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "contributor_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributor_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contributors_agency_id_status_idx" ON "contributors"("agency_id", "status");

-- CreateIndex
CREATE INDEX "contributors_agency_id_email_idx" ON "contributors"("agency_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "contributors_agency_id_reference_number_key" ON "contributors"("agency_id", "reference_number");

-- CreateIndex
CREATE INDEX "contributor_assignments_agency_id_contributor_id_effective__idx" ON "contributor_assignments"("agency_id", "contributor_id", "effective_from");

-- CreateIndex
CREATE INDEX "contributor_assignments_agency_id_agent_id_effective_from_idx" ON "contributor_assignments"("agency_id", "agent_id", "effective_from");

-- CreateIndex
CREATE INDEX "contributor_plans_agency_id_contributor_id_status_idx" ON "contributor_plans"("agency_id", "contributor_id", "status");

-- CreateIndex
CREATE INDEX "contributor_plans_agency_id_start_date_idx" ON "contributor_plans"("agency_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "contributor_invitations_token_hash_key" ON "contributor_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "contributor_invitations_agency_id_contributor_id_expires_at_idx" ON "contributor_invitations"("agency_id", "contributor_id", "expires_at");

-- AddForeignKey
ALTER TABLE "contributors" ADD CONSTRAINT "contributors_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_assignments" ADD CONSTRAINT "contributor_assignments_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_assignments" ADD CONSTRAINT "contributor_assignments_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "contributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_assignments" ADD CONSTRAINT "contributor_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_plans" ADD CONSTRAINT "contributor_plans_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_plans" ADD CONSTRAINT "contributor_plans_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "contributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_invitations" ADD CONSTRAINT "contributor_invitations_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_invitations" ADD CONSTRAINT "contributor_invitations_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "contributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
