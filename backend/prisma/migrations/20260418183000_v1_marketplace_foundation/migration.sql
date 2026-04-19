-- V1 marketplace foundation batch
-- Adds canonical request/proposal/appointment foundation for marketplace coordination only.

CREATE TYPE "RequestStatus" AS ENUM (
  'draft',
  'published',
  'receiving_proposals',
  'in_coordination',
  'closed',
  'completed',
  'expired'
);

CREATE TYPE "ProposalStatus" AS ENUM (
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
  'withdrawn'
);

CREATE TYPE "AppointmentStatus" AS ENUM (
  'coordinating',
  'scheduled',
  'in_progress',
  'pending_completion_confirmation',
  'completed',
  'cancelled'
);

CREATE TYPE "RequestMediaType" AS ENUM ('image', 'video');

CREATE TYPE "AppointmentCancellationActor" AS ENUM (
  'client',
  'professional',
  'system'
);

CREATE TABLE "requests" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "title" VARCHAR(100) NOT NULL,
  "description" TEXT NOT NULL,
  "latitude" DECIMAL(10,8) NOT NULL,
  "longitude" DECIMAL(11,8) NOT NULL,
  "status" "RequestStatus" NOT NULL DEFAULT 'draft',
  "expires_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "request_categories" (
  "request_id" INTEGER NOT NULL,
  "category_id" INTEGER NOT NULL,
  CONSTRAINT "request_categories_pkey" PRIMARY KEY ("request_id", "category_id")
);

CREATE TABLE "request_media" (
  "id" SERIAL NOT NULL,
  "request_id" INTEGER NOT NULL,
  "media_type" "RequestMediaType" NOT NULL,
  "media_url" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "request_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proposals" (
  "id" SERIAL NOT NULL,
  "request_id" INTEGER NOT NULL,
  "professional_id" INTEGER NOT NULL,
  "price_reference" DECIMAL(10,2) NOT NULL,
  "scope_notes" TEXT NOT NULL,
  "proposed_date" DATE,
  "proposed_time" TIME,
  "status" "ProposalStatus" NOT NULL DEFAULT 'sent',
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proposals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "proposals_price_reference_check" CHECK ("price_reference" > 0)
);

CREATE TABLE "appointments" (
  "id" SERIAL NOT NULL,
  "proposal_id" INTEGER NOT NULL,
  "request_id" INTEGER NOT NULL,
  "scheduled_date" DATE,
  "scheduled_time" TIME,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'coordinating',
  "rescheduled_count" INTEGER NOT NULL DEFAULT 0,
  "cancellation_reason" TEXT,
  "cancelled_by" "AppointmentCancellationActor",
  "client_confirmed_completion_at" TIMESTAMPTZ,
  "professional_confirmed_completion_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointments_proposal_id_key" UNIQUE ("proposal_id"),
  CONSTRAINT "appointments_rescheduled_count_check" CHECK ("rescheduled_count" >= 0),
  CONSTRAINT "appointments_completion_state_check" CHECK (
    (
      "status" = 'completed'
      AND "client_confirmed_completion_at" IS NOT NULL
      AND "professional_confirmed_completion_at" IS NOT NULL
      AND "completed_at" IS NOT NULL
    )
    OR ("status" <> 'completed')
  )
);

CREATE INDEX "requests_user_id_idx" ON "requests"("user_id");
CREATE INDEX "requests_status_idx" ON "requests"("status");
CREATE INDEX "requests_expires_at_idx" ON "requests"("expires_at");
CREATE INDEX "requests_deleted_at_idx" ON "requests"("deleted_at");
CREATE INDEX "requests_created_at_idx" ON "requests"("created_at");
CREATE INDEX "requests_latitude_longitude_idx" ON "requests"("latitude", "longitude");

CREATE INDEX "request_categories_request_id_idx" ON "request_categories"("request_id");
CREATE INDEX "request_categories_category_id_idx" ON "request_categories"("category_id");

CREATE INDEX "request_media_request_id_idx" ON "request_media"("request_id");

CREATE INDEX "proposals_request_id_idx" ON "proposals"("request_id");
CREATE INDEX "proposals_professional_id_idx" ON "proposals"("professional_id");
CREATE INDEX "proposals_status_idx" ON "proposals"("status");
CREATE INDEX "proposals_expires_at_idx" ON "proposals"("expires_at");

CREATE INDEX "appointments_request_id_idx" ON "appointments"("request_id");
CREATE INDEX "appointments_status_idx" ON "appointments"("status");
CREATE INDEX "appointments_scheduled_date_idx" ON "appointments"("scheduled_date");

ALTER TABLE "requests"
  ADD CONSTRAINT "requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "request_categories"
  ADD CONSTRAINT "request_categories_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "request_categories"
  ADD CONSTRAINT "request_categories_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "request_media"
  ADD CONSTRAINT "request_media_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "proposals"
  ADD CONSTRAINT "proposals_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "proposals"
  ADD CONSTRAINT "proposals_professional_id_fkey"
  FOREIGN KEY ("professional_id") REFERENCES "professionals"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_proposal_id_fkey"
  FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
