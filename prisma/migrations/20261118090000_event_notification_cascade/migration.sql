ALTER TABLE "notifications"
  DROP CONSTRAINT "notifications_eventId_fkey",
  ADD CONSTRAINT "notifications_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
