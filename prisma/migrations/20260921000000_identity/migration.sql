-- Generated migration source for the approved identity schema.
-- Review with Prisma before applying to a shared environment.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "AgencyStatus" AS ENUM ('pending', 'active', 'suspended', 'closed');
CREATE TYPE "MembershipRole" AS ENUM ('admin', 'finance_reviewer', 'agent', 'support', 'auditor');
CREATE TYPE "MembershipStatus" AS ENUM ('invited', 'active', 'suspended', 'removed');
CREATE TYPE "OneTimeTokenPurpose" AS ENUM ('email_verification', 'password_reset');
CREATE TYPE "MfaFactorType" AS ENUM ('passkey', 'totp');

CREATE TABLE "agencies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "legal_name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "AgencyStatus" NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "agencies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agencies_currency_upper_check" CHECK ("currency" = UPPER("currency"))
);

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "email_verified_at" TIMESTAMPTZ,
  "disabled_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" (LOWER("email"));

CREATE TABLE "agency_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "agency_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "status" "MembershipStatus" NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "agency_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agency_memberships_agency_id_user_id_role_key" ON "agency_memberships" ("agency_id", "user_id", "role");
CREATE INDEX "agency_memberships_agency_id_status_idx" ON "agency_memberships" ("agency_id", "status");

CREATE TABLE "password_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "password_hash" TEXT NOT NULL,
  "password_changed_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "password_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_credentials_user_id_key" ON "password_credentials" ("user_id");

CREATE TABLE "password_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "password_hash" TEXT NOT NULL,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_history_user_id_recorded_at_idx" ON "password_history" ("user_id", "recorded_at" DESC);

CREATE TABLE "authentication_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "agency_id" UUID NOT NULL,
  "roles" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  "last_activity_at" TIMESTAMPTZ NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "revoked_reason" TEXT,
  "refresh_family_id" UUID NOT NULL,
  "current_refresh_token_hash" TEXT NOT NULL,
  "mfa_satisfied_at" TIMESTAMPTZ,
  CONSTRAINT "authentication_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "authentication_sessions_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE INDEX "authentication_sessions_user_id_created_at_idx" ON "authentication_sessions" ("user_id", "created_at" DESC);
CREATE INDEX "authentication_sessions_refresh_family_id_idx" ON "authentication_sessions" ("refresh_family_id");

CREATE TABLE "refresh_token_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "refresh_family_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "issued_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "replaced_by_hash" TEXT,
  CONSTRAINT "refresh_token_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_token_history_token_hash_key" ON "refresh_token_history" ("token_hash");
CREATE INDEX "refresh_token_history_session_id_issued_at_idx" ON "refresh_token_history" ("session_id", "issued_at" DESC);

CREATE TABLE "one_time_identity_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "purpose" "OneTimeTokenPurpose" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "consumed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "one_time_identity_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "one_time_identity_tokens_token_hash_key" ON "one_time_identity_tokens" ("token_hash");
CREATE INDEX "one_time_identity_tokens_user_id_purpose_expires_at_idx" ON "one_time_identity_tokens" ("user_id", "purpose", "expires_at");

CREATE TABLE "mfa_factors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "factor_type" "MfaFactorType" NOT NULL,
  "protected_secret_reference" TEXT,
  "enabled_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_factors_user_id_factor_type_revoked_at_idx" ON "mfa_factors" ("user_id", "factor_type", "revoked_at");

CREATE TABLE "authentication_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "agency_id" UUID,
  "event_type" TEXT NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "correlation_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "authentication_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "authentication_events_user_id_occurred_at_idx" ON "authentication_events" ("user_id", "occurred_at" DESC);

ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "password_credentials" ADD CONSTRAINT "password_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authentication_sessions" ADD CONSTRAINT "authentication_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authentication_sessions" ADD CONSTRAINT "authentication_sessions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refresh_token_history" ADD CONSTRAINT "refresh_token_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "authentication_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "one_time_identity_tokens" ADD CONSTRAINT "one_time_identity_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authentication_events" ADD CONSTRAINT "authentication_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "authentication_events" ADD CONSTRAINT "authentication_events_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
