-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" UUID,
    "identifier" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "territory" TEXT,
    "status" "AgentStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_assignments" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "territory" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_user_id_key" ON "agents"("user_id");

-- CreateIndex
CREATE INDEX "agents_agency_id_status_idx" ON "agents"("agency_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agents_agency_id_identifier_key" ON "agents"("agency_id", "identifier");

-- CreateIndex
CREATE INDEX "agent_assignments_agency_id_agent_id_effective_from_idx" ON "agent_assignments"("agency_id", "agent_id", "effective_from");

-- CreateIndex
CREATE INDEX "agent_assignments_agency_id_territory_effective_from_idx" ON "agent_assignments"("agency_id", "territory", "effective_from");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
