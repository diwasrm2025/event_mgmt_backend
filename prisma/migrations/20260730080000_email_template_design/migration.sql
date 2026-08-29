-- Persist the drag-and-drop builder's block structure alongside the
-- rendered HTML, so a template can be re-opened and edited visually
-- instead of only as raw HTML.
ALTER TABLE "email_templates" ADD COLUMN "design" TEXT;
