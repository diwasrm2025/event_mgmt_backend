ALTER TABLE "events" ADD COLUMN "previewToken" TEXT;
CREATE UNIQUE INDEX "events_previewToken_key" ON "events"("previewToken");

ALTER TABLE "bookings" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
