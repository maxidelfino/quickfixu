CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "appointment_id" INTEGER NOT NULL,
    "reviewer_user_id" INTEGER NOT NULL,
    "reviewed_user_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reviews_appointment_id_reviewer_user_id_key" ON "reviews"("appointment_id", "reviewer_user_id");
CREATE INDEX "reviews_appointment_id_idx" ON "reviews"("appointment_id");
CREATE INDEX "reviews_reviewed_user_id_created_at_idx" ON "reviews"("reviewed_user_id", "created_at");

ALTER TABLE "reviews"
ADD CONSTRAINT "reviews_appointment_id_fkey"
FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reviews"
ADD CONSTRAINT "reviews_reviewer_user_id_fkey"
FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reviews"
ADD CONSTRAINT "reviews_reviewed_user_id_fkey"
FOREIGN KEY ("reviewed_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
