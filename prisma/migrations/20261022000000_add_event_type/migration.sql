ALTER TABLE "events" ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'free';
UPDATE "events" SET "eventType" = CASE WHEN "price" > 0 THEN 'paid' ELSE 'free' END;
