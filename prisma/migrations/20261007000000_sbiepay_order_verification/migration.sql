ALTER TABLE "bookings" ADD COLUMN "merchantOrderNumber" TEXT,
ADD COLUMN "sbiOrderRefNumber" TEXT, ADD COLUMN "atrnNumber" TEXT,
ADD COLUMN "orderStatus" TEXT, ADD COLUMN "orderLastCheckedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "bookings_merchantOrderNumber_key" ON "bookings"("merchantOrderNumber");
CREATE INDEX "bookings_paymentMethod_paymentStatus_orderLastCheckedAt_idx" ON "bookings"("paymentMethod", "paymentStatus", "orderLastCheckedAt");
