-- RBAC: roles table -----------------------------------------------------
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- Seed the three system roles with fixed, well-known ids so later
-- migrations/seed scripts can reference them deterministically.
INSERT INTO "roles" ("id", "name", "description", "permissions", "isSystem", "updatedAt") VALUES
  ('00000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'Full access to every event and all administrative functions.', ARRAY['events:create','events:manage_all','users:manage','roles:manage'], true, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000002', 'ORGANIZER', 'Can create and manage their own events, and events shared with them.', ARRAY['events:create'], true, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000003', 'ATTENDEE', 'Signed-in visitor with no event-management permissions.', ARRAY[]::TEXT[], true, CURRENT_TIMESTAMP);

-- Users: switch to Google-only auth, add role -----------------------------
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;
ALTER TABLE "users" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "users" ADD COLUMN "roleId" TEXT;

-- Backfill existing rows (e.g. the seeded demo account) so the columns can
-- be made NOT NULL. Legacy password-based accounts get a placeholder,
-- non-matchable googleId — they must sign in with Google again to link
-- their real account. Default role is ORGANIZER.
UPDATE "users" SET "googleId" = 'legacy-' || "id" WHERE "googleId" IS NULL;
UPDATE "users" SET "roleId" = '00000000-0000-0000-0000-000000000002' WHERE "roleId" IS NULL;

ALTER TABLE "users" ALTER COLUMN "googleId" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "roleId" SET NOT NULL;

CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users" DROP COLUMN "password";

-- Events: userId -> ownerId (rename, keep FK behavior identical) ---------
ALTER TABLE "events" RENAME COLUMN "userId" TO "ownerId";
ALTER TABLE "events" DROP CONSTRAINT "events_userId_fkey";
DROP INDEX "events_userId_idx";
CREATE INDEX "events_ownerId_idx" ON "events"("ownerId");
ALTER TABLE "events" ADD CONSTRAINT "events_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-event, per-user access grants ---------------------------------------
CREATE TABLE "event_permissions" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'VIEW',
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_permissions_eventId_userId_key" ON "event_permissions"("eventId", "userId");
CREATE INDEX "event_permissions_eventId_idx" ON "event_permissions"("eventId");
CREATE INDEX "event_permissions_userId_idx" ON "event_permissions"("userId");

ALTER TABLE "event_permissions" ADD CONSTRAINT "event_permissions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_permissions" ADD CONSTRAINT "event_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
