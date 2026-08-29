-- Revert Google Sign-In back to plain email/password authentication -------
-- Drop the googleId unique constraint/column.
DROP INDEX IF EXISTS "users_googleId_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "googleId";

-- Add password back. Existing rows (seed/demo users) get an empty hash —
-- they cannot log in until reseeded or their password is reset directly;
-- this only ever affects placeholder demo data, never a real deployment.
ALTER TABLE "users" ADD COLUMN "password" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ALTER COLUMN "password" DROP DEFAULT;
