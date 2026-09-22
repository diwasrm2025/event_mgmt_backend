require('ts-node/register');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BookingsService } = require('../src/bookings/bookings.service');

const proof = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function setup(price = 100) {
  const event = { id: 'event', title: 'Test event', price, attendees: 0, capacity: 2, fields: [] };
  const state = { booking: null, emails: [] };
  const db = {
    event: {
      findFirst: async () => event,
      findUniqueOrThrow: async () => event,
      update: async ({ data }) => { event.attendees += data.attendees.increment; return event; },
    },
    booking: {
      findFirst: async ({ where }) => {
        if (where.transactionId) return state.booking?.transactionId === where.transactionId ? state.booking : null;
        if (where.paymentAccessToken && where.paymentAccessToken !== state.booking?.paymentAccessToken) return null;
        return state.booking ? { ...state.booking, event } : null;
      },
      create: async ({ data }) => (state.booking = { id: 'booking', paymentAccessToken: 'secret', ...data }),
      update: async ({ data }) => (state.booking = { ...state.booking, ...data, event }),
    },
    $transaction: async (callback) => callback(db),
  };
  const service = new BookingsService(db, { sendMail: async (...args) => { state.emails.push(args); return { success: true }; } });
  const submit = (extra = {}) => service.createBooking('test', { name: 'Member', email: 'member@example.com', transactionId: 'UTR123456', paymentProof: proof, ...extra });
  return { service, state, event, submit };
}

test('paid registration requires both reference and real image evidence', async () => {
  const { submit } = setup();
  await assert.rejects(submit({ transactionId: '' }), /transaction ID/);
  await assert.rejects(submit({ paymentProof: undefined }), /screenshot/);
  await assert.rejects(submit({ paymentProof: 'data:image/png;base64,aGVsbG8=' }), /valid screenshot/);
});
test('submission remains pending without reserving seats or sending email', async () => {
  const { submit, state, event } = setup();
  const booking = await submit();
  assert.equal(booking.paymentStatus, 'pending');
  assert.equal(booking.registrationStatus, 'pending');
  assert.equal(event.attendees, 0);
  assert.equal(state.emails.length, 0);
});
test('approval completes payment and sends one thank-you email even when repeated', async () => {
  const { submit, service, state, event } = setup();
  await submit();
  const result = await service.updateRegistrationStatus('event', 'booking', { status: 'approved' });
  assert.equal(result.paymentStatus, 'paid');
  assert.ok(result.paidAt);
  assert.equal(result.transactionId, 'UTR123456');
  await service.updateRegistrationStatus('event', 'booking', { status: 'approved' });
  assert.equal(event.attendees, 1);
  assert.equal(state.emails.length, 1);
  assert.match(state.emails[0][1], /Thank you for registering/);
});
test('duplicate transaction IDs are rejected', async () => {
  const { submit } = setup();
  await submit();
  await assert.rejects(submit(), /already been submitted/);
});
test('rejection sends no confirmation and reserves no seats', async () => {
  const { submit, service, state, event } = setup();
  await submit();
  const result = await service.updateRegistrationStatus('event', 'booking', { status: 'rejected', reason: 'Transaction does not match the screenshot.' });
  assert.equal(result.paymentStatus, 'failed');
  assert.equal(result.rejectionReason, 'Transaction does not match the screenshot.');
  assert.equal(event.attendees, 0);
  assert.equal(state.emails.length, 0);
});
test('approval refuses missing evidence and sold-out events', async () => {
  const { submit, service, state, event } = setup();
  await submit();
  event.attendees = 2;
  await assert.rejects(service.updateRegistrationStatus('event', 'booking', { status: 'approved' }), /No seats/);
  event.attendees = 0;
  state.booking.paymentProof = null;
  await assert.rejects(service.updateRegistrationStatus('event', 'booking', { status: 'approved' }), /proof are required/);
});
test('free registrations still complete immediately', async () => {
  const { submit, state, event } = setup(0);
  const result = await submit({ transactionId: undefined, paymentProof: undefined });
  assert.equal(result.paymentStatus, 'paid');
  assert.equal(event.attendees, 1);
  assert.equal(state.emails.length, 1);
});
test('status lookup requires the private booking token', async () => {
  const { submit, service } = setup();
  await submit();
  await assert.rejects(service.paymentStatus('booking', ''), /not found/);
  await assert.rejects(service.paymentStatus('booking', 'wrong'), /not found/);
  assert.equal((await service.paymentStatus('booking', 'secret')).paymentStatus, 'pending');
});

test('rejection requires a non-empty reason and approval clears an earlier reason', async () => {
  const { submit, service } = setup();
  await submit();
  await assert.rejects(service.updateRegistrationStatus('event', 'booking', { status: 'rejected' }), /reason is required/);
  await assert.rejects(service.updateRegistrationStatus('event', 'booking', { status: 'rejected', reason: '   ' }), /reason is required/);
  await service.updateRegistrationStatus('event', 'booking', { status: 'rejected', reason: 'Needs verification' });
  const review = await service.paymentStatus('booking', 'secret');
  assert.equal(review.rejectionReason, 'Needs verification');
  const approved = await service.updateRegistrationStatus('event', 'booking', { status: 'approved' });
  assert.equal(approved.rejectionReason, null);
});
