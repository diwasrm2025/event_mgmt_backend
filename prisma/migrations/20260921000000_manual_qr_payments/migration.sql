ALTER TABLE "bookings" DROP COLUMN IF EXISTS "razorpayOrderId", ADD COLUMN "paymentProof" TEXT;
CREATE UNIQUE INDEX "bookings_qr_transaction_unique" ON "bookings" ("transactionId") WHERE "paymentMethod" = 'qr';
ALTER TABLE "bookings" ADD COLUMN "paymentAccessToken" TEXT;
UPDATE "bookings" SET "paymentAccessToken" = gen_random_uuid()::text;
ALTER TABLE "bookings" ALTER COLUMN "paymentAccessToken" SET NOT NULL;
CREATE UNIQUE INDEX "bookings_paymentAccessToken_key" ON "bookings" ("paymentAccessToken");
