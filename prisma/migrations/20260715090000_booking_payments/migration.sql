-- AlterTable: track the e-commerce-style checkout/payment lifecycle on each booking.
-- amount is frozen at seats * event.price when the order is placed.
-- paymentStatus: pending | paid | failed | refunded (server-controlled, never client-supplied)
-- paymentMethod: card | upi | netbanking | wallet | free
ALTER TABLE "bookings"
  ADD COLUMN "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "transactionId" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);

-- Backfill: existing rows (created before payments existed) represent
-- already-honored free/legacy bookings, so mark them settled rather than
-- leaving them stuck showing as an unpaid order in the new admin UI.
UPDATE "bookings" SET "paymentStatus" = 'paid', "paidAt" = "createdAt" WHERE "status" = 'confirmed';
