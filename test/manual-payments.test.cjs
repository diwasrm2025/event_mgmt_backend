require('ts-node/register');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { BookingsService } = require('../src/bookings/bookings.service');
async function setup() {
  const event = { id: 'e', ownerId: 'owner', title: 'Conference', eventType: 'paid', status: 'published', price: 100, capacity: 3, attendees: 0, fields: [] };
  const state = { booking: null, emails: [] };
  const db = {
    user: { findMany: async () => [{ email: 'admin@example.com' }, { email: 'owner@example.com' }] },
    event: { findFirst: async () => event, findUniqueOrThrow: async () => event, update: async ({data}) => { event.attendees += data.attendees.increment; return event; } },
    booking: { create: async ({data}) => state.booking = { id: 'b', ...data }, findFirst: async () => ({ ...state.booking, event }), update: async ({data}) => state.booking = { ...state.booking, ...data, event } },
    $transaction: async fn => fn(db),
  };
  const cloudinary = {
    uploadBuffer: async () => ({
      publicId: 'event-mgmt/payment-proofs/proof',
      secureUrl: 'https://res.cloudinary.com/test/image/authenticated/upload/v1/event-mgmt/payment-proofs/proof.png',
      format: 'png',
      version: 1,
      resourceType: 'image',
      deliveryType: 'authenticated',
    }),
    deleteByPublicId: async () => {},
  };
  const service = new BookingsService(db, { sendMail: async (...args) => state.emails.push(args) }, { assertConfigured: () => assert.fail('SBI must not be used') }, cloudinary);
  const image = await sharp({create: {width: 2, height: 2, channels: 3, background: 'white'}}).png().toBuffer();
  const dto = { name: 'Attendee', email: 'user@example.com', paymentMethod: 'qr', transactionId: 'UTR123456', paymentProof: 'data:image/png;base64,' + image.toString('base64') };
  return { service, state, event, dto };
}
test('QR submission stays pending, notifies reviewers, and approval sends one ticket', async () => {
  const {service, state, event, dto} = await setup();
  const response = await service.createBooking('event', dto);
  assert.equal(state.booking.paymentMethod, 'qr'); assert.match(state.booking.paymentProof, /^https:\/\/res\.cloudinary\.com\//);
  assert.equal(state.booking.paymentProofPublicId, 'event-mgmt/payment-proofs/proof');
  assert.equal(response.paymentProof, null);
  assert.equal(response.paymentProofPublicId, undefined);
  assert.equal(state.booking.paymentStatus, 'pending'); assert.equal(event.attendees, 0);
  assert.deepEqual(state.emails.map(e => e[0]), ['admin@example.com', 'owner@example.com']);
  await assert.rejects(service.toggleCheckIn('e', 'b'), /Approve payment/);
  await service.updateRegistrationStatus('e', 'b', {status: 'approved'});
  assert.equal(event.attendees, 1); assert.equal(state.booking.paymentStatus, 'paid');
  const count = state.emails.length;
  assert.equal(state.emails.filter(e => e[0] === dto.email).length, 1);
  await service.updateRegistrationStatus('e', 'b', {status: 'approved'});
  assert.equal(state.emails.length, count); assert.equal(event.attendees, 1);
});
test('rejection requires a reason and emails an escaped reason to attendee and reviewers once', async () => {
  const {service, state, dto} = await setup(); await service.createBooking('event', dto);
  await assert.rejects(service.updateRegistrationStatus('e', 'b', {status: 'rejected'}), /reason is required/);
  await service.updateRegistrationStatus('e', 'b', {status: 'rejected', reason: 'Amount < fee'});
  const email = state.emails.find(e => e[0] === dto.email);
  assert.match(email[1], /rejected/); assert.match(email[2], /Amount &lt; fee/);
  assert.equal(state.booking.paymentStatus, 'failed');
  const count = state.emails.length;
  await service.updateRegistrationStatus('e', 'b', {status: 'rejected', reason: 'Amount < fee'});
  assert.equal(state.emails.length, count);
});
test('missing or forged proof and unavailable capacity cannot confirm payment', async () => {
  const {service, state, dto, event} = await setup();
  await assert.rejects(service.createBooking('event', {...dto, paymentProof: undefined}), /Attach/);
  await assert.rejects(service.createBooking('event', {...dto, paymentProof: 'data:image/png;base64,YWJj'}), /not a valid image/);
  await service.createBooking('event', dto); event.attendees = 3;
  await assert.rejects(service.updateRegistrationStatus('e', 'b', {status: 'approved'}), /No seats/);
  assert.equal(state.booking.paymentStatus, 'pending');
});
