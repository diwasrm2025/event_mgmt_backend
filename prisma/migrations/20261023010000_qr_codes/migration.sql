CREATE TABLE "qr_codes" (
 "id" TEXT NOT NULL, "title" TEXT NOT NULL, "url" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "qr_codes_ownerId_idx" ON "qr_codes"("ownerId");
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
