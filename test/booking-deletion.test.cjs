require('ts-node/register');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BookingsService } = require('../src/bookings/bookings.service');

function setup(overrides = {}) {
  const booking = { id: 'booking', eventId: 'event', status: 'confirmed', registrationStatus: 'approved', paymentMethod: 'free', paymentStatus: 'paid', seats: 2, event: { attendees: 5, capacity: 5, status: 'sold-out' }, ...overrides };
  const calls = {};
  const tx = {
    booking: {
      findFirst: async args => { calls.lookup = args.where; return booking; },
      delete: async args => { calls.deleted = args.where; },
    },
    event: { update: async args => { calls.event = args.data; } },
  };
  const service = new BookingsService({ $transaction: async (callback, options) => { calls.isolation = options.isolationLevel; return callback(tx); } }, {}, {});
  return { service, calls };
}

test('deletion scopes booking to event and releases confirmed seats atomically', async () => {
  const { service, calls } = setup();
  assert.deepEqual(await service.deleteBooking('event', 'booking'), { id: 'booking' });
  assert.deepEqual(calls.lookup, { id: 'booking', eventId: 'event' });
  assert.deepEqual(calls.deleted, { id: 'booking' });
  assert.deepEqual(calls.event, { attendees: 3, status: 'published' });
  assert.equal(calls.isolation, 'Serializable');
});

test('unconfirmed deletion does not release seats; completed events stay completed', async () => {
  const pending = setup({ status: 'pending', registrationStatus: 'pending', paymentStatus: 'failed' });
  await pending.service.deleteBooking('event', 'booking');
  assert.equal(pending.calls.event, undefined);
  const completed = setup({ event: { attendees: 1, capacity: 5, status: 'completed' } });
  await completed.service.deleteBooking('event', 'booking');
  assert.deepEqual(completed.calls.event, { attendees: 0 });
});

test('unsettled SBI orders cannot be deleted', async () => {
  const { service, calls } = setup({ paymentMethod: 'sbiepay', paymentStatus: 'pending' });
  await assert.rejects(service.deleteBooking('event', 'booking'), /payment verification/);
  assert.equal(calls.deleted, undefined);
});

test('unknown or other-event bookings cannot be deleted', async () => {
  const service = new BookingsService({ $transaction: async callback => callback({ booking: { findFirst: async () => null } }) }, {}, {});
  await assert.rejects(service.deleteBooking('other-event', 'booking'), /Booking not found/);
});
