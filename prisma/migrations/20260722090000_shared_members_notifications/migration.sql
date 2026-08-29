-- Event permissions: single "level" -> combinable "permissions" array,
-- plus a status so Revoke Access (history kept) differs from Remove
-- Member (row deleted). --------------------------------------------------
ALTER TABLE "event_permissions" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "event_permissions" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- Carry any existing single-level grants into the new array column before
-- dropping "level", so nobody's access silently disappears.
UPDATE "event_permissions" SET "permissions" = ARRAY["level"] WHERE "level" IS NOT NULL;

ALTER TABLE "event_permissions" DROP COLUMN "level";

-- grantedById existed as a bare, unconstrained text column — give it a
-- real foreign key now so "Shared By" can be joined safely. Any grant
-- referencing a since-deleted user is nulled out first so the constraint
-- can be added.
UPDATE "event_permissions" ep
SET "grantedById" = NULL
WHERE ep."grantedById" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = ep."grantedById");

ALTER TABLE "event_permissions" ADD CONSTRAINT "event_permissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bookings: attendee check-in/out + approve-reject workflow ----------------
ALTER TABLE "bookings" ADD COLUMN "registrationStatus" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "bookings" ADD COLUMN "checkedIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bookings" ADD COLUMN "checkedInAt" TIMESTAMP(3);

-- Notifications -------------------------------------------------------------
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_eventId_idx" ON "notifications"("eventId");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
