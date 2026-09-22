Paid registrations use the static QR at `frontend/app/images/payment_qr.jpeg`.
Replace that file to change the receiving QR, then rebuild the frontend.
`NEXT_PUBLIC_PAYMENT_QR_URL` can optionally override it with an image URL.

Attendees complete their details, pay, and submit a transaction ID and a PNG,
JPEG or WebP screenshot (up to 5 MB). The evidence is stored in the database
and appears in the event's full attendee roster. Payment remains pending.

The event owner or super admin reviews the screenshot and selects Approved
or Rejected in the registration status column. Approval marks payment paid
(displayed as Completed), reserves the seat, and sends the existing ticket
email with a thank-you message. Repeated approvals do not repeat the email
or seat reservation. Free registrations complete immediately.

The attendee's confirmation page refreshes status every 10 seconds using a
private booking token. Pending and rejected submissions do not receive a
confirmation email and cannot check in.

Deployment: run `npm run prisma:deploy`, `npm run prisma:generate`, and rebuild
and restart the backend and frontend. If Windows reports a locked Prisma
engine DLL during generation, stop the backend before regenerating it.
Configure the existing SMTP or Brevo mail transport for email delivery.
MailService logs delivery failures; it does not automatically retry them.

Verification: `node --test test/manual-payments.test.cjs` from `backend`.

Payment submissions display a confirmation popup with the attendee email and a private /payment-status link. The token is kept in the link fragment. Administrators must provide a rejection reason, which is shown on the status page. Status can be refreshed manually and updates every 10 seconds.
