-- DropIndex (slug becomes nullable, so the old unique index is recreated below)
ALTER TABLE "events" ALTER COLUMN "slug" DROP NOT NULL;
ALTER TABLE "events" ALTER COLUMN "date" SET DEFAULT '';
ALTER TABLE "events" ALTER COLUMN "date" DROP NOT NULL;
ALTER TABLE "events" ALTER COLUMN "time" SET DEFAULT '';
ALTER TABLE "events" ALTER COLUMN "time" DROP NOT NULL;
ALTER TABLE "events" ALTER COLUMN "venue" SET DEFAULT '';
ALTER TABLE "events" ALTER COLUMN "venue" DROP NOT NULL;

-- AlterTable
ALTER TABLE "events"
  ADD COLUMN "banners" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "wizardStep" INTEGER NOT NULL DEFAULT 1;

-- Backfill: existing rows already have a real slug/date/time/venue, so no
-- data migration is needed beyond the column defaults above.

-- CreateTable
CREATE TABLE "event_form_fields" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "event_form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "responses" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_form_fields_eventId_idx" ON "event_form_fields"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_form_fields_eventId_name_key" ON "event_form_fields"("eventId", "name");

-- CreateIndex
CREATE INDEX "bookings_eventId_idx" ON "bookings"("eventId");

-- CreateIndex
CREATE INDEX "bookings_userId_idx" ON "bookings"("userId");

-- AddForeignKey
ALTER TABLE "event_form_fields" ADD CONSTRAINT "event_form_fields_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
