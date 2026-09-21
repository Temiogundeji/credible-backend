-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('asset', 'liability', 'equity', 'revenue');

-- CreateEnum
CREATE TYPE "LedgerAccountStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "LedgerJournalStatus" AS ENUM ('posted', 'reversed');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('posted', 'reversed');

-- CreateEnum
CREATE TYPE "ContributionPaymentMethod" AS ENUM ('cash', 'bank_transfer', 'mobile_money');

-- CreateEnum
CREATE TYPE "ContributionAllocationType" AS ENUM ('obligation', 'overpayment_credit');

-- CreateEnum
CREATE TYPE "ContributorCreditStatus" AS ENUM ('available', 'applied', 'refunded', 'reversed');

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "status" "LedgerAccountStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_journals" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "source_type" VARCHAR(80) NOT NULL,
    "source_id" UUID NOT NULL,
    "command_type" VARCHAR(80) NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "LedgerJournalStatus" NOT NULL,
    "actor_id" UUID NOT NULL,
    "correlation_id" VARCHAR(100),
    "reversal_of_id" UUID,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_journal_lines" (
    "id" UUID NOT NULL,
    "journal_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "memo" TEXT,

    CONSTRAINT "ledger_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "contributor_id" UUID NOT NULL,
    "obligation_id" UUID,
    "agent_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "payment_method" "ContributionPaymentMethod" NOT NULL,
    "business_date" DATE NOT NULL,
    "status" "ContributionStatus" NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "journal_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "userId" UUID,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_allocations" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "contribution_id" UUID NOT NULL,
    "obligation_id" UUID,
    "credit_id" UUID,
    "amount_minor" BIGINT NOT NULL,
    "allocation_type" "ContributionAllocationType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contribution_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributor_credits" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "contributor_id" UUID NOT NULL,
    "source_contribution_id" UUID NOT NULL,
    "original_amount_minor" BIGINT NOT NULL,
    "remaining_amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "ContributorCreditStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributor_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_accounts_agency_id_status_idx" ON "ledger_accounts"("agency_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_agency_id_code_key" ON "ledger_accounts"("agency_id", "code");

-- CreateIndex
CREATE INDEX "ledger_journals_agency_id_posted_at_idx" ON "ledger_journals"("agency_id", "posted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_journals_agency_id_source_type_source_id_key" ON "ledger_journals"("agency_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_journals_agency_id_command_type_idempotency_key_key" ON "ledger_journals"("agency_id", "command_type", "idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_journal_lines_journal_id_idx" ON "ledger_journal_lines"("journal_id");

-- CreateIndex
CREATE INDEX "ledger_journal_lines_account_id_idx" ON "ledger_journal_lines"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_journal_id_key" ON "contributions"("journal_id");

-- CreateIndex
CREATE INDEX "contributions_agency_id_contributor_id_business_date_idx" ON "contributions"("agency_id", "contributor_id", "business_date");

-- CreateIndex
CREATE INDEX "contributions_agency_id_agent_id_business_date_idx" ON "contributions"("agency_id", "agent_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_agency_id_idempotency_key_key" ON "contributions"("agency_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "contribution_allocations_agency_id_contribution_id_idx" ON "contribution_allocations"("agency_id", "contribution_id");

-- CreateIndex
CREATE INDEX "contribution_allocations_agency_id_obligation_id_idx" ON "contribution_allocations"("agency_id", "obligation_id");

-- CreateIndex
CREATE INDEX "contributor_credits_agency_id_contributor_id_status_idx" ON "contributor_credits"("agency_id", "contributor_id", "status");

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_journals" ADD CONSTRAINT "ledger_journals_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_journals" ADD CONSTRAINT "ledger_journals_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "ledger_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_journal_lines" ADD CONSTRAINT "ledger_journal_lines_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "ledger_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_journal_lines" ADD CONSTRAINT "ledger_journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "contributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "contributor_obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "ledger_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_allocations" ADD CONSTRAINT "contribution_allocations_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_allocations" ADD CONSTRAINT "contribution_allocations_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "contributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_allocations" ADD CONSTRAINT "contribution_allocations_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "contributor_obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_allocations" ADD CONSTRAINT "contribution_allocations_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "contributor_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_credits" ADD CONSTRAINT "contributor_credits_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_credits" ADD CONSTRAINT "contributor_credits_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "contributors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_credits" ADD CONSTRAINT "contributor_credits_source_contribution_id_fkey" FOREIGN KEY ("source_contribution_id") REFERENCES "contributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
