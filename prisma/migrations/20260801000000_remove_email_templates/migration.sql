-- Email templates are no longer customizable via the database / Super
-- Admin UI. All transactional email designs (welcome, shared-access
-- updates, event ticket confirmation, role updates) are now static code
-- templates in backend/src/mail/templates/email-templates.ts.
-- Drop the now-unused email_templates table and its FK.
ALTER TABLE "email_templates" DROP CONSTRAINT IF EXISTS "email_templates_createdById_fkey";
DROP TABLE IF EXISTS "email_templates";
