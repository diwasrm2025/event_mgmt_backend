require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SbiepayService } = require('../dist/src/sbiepay/sbiepay.service');
const { BookingsService } = require('../dist/src/bookings/bookings.service');

test('missing SBI credentials allow free bookings and reject paid bookings before persistence', async () => {
  const keys = ['SBIEPAY_API_KEY', 'SBIEPAY_API_SECRET', 'SBIEPAY_ENCRYPTION_KEY'];
  const saved = keys.map((key) => process.env[key]);
  try {
    keys.forEach((key) => delete process.env[key]);
    const gateway = new SbiepayService();
    assert.throws(() => gateway.assertConfigured(), /SBIEPAY_API_KEY/);
    const event = { id: 'event', title: 'Test event', eventType: 'free', price: 0, capacity: 10, attendees: 0, fields: [] };
    let transactions = 0;
    const prisma = {
      event: { findFirst: async () => event },
      $transaction: async (callback) => {
        transactions++;
        return callback({
          event: { findUniqueOrThrow: async () => event, update: async () => event },
          booking: { create: async ({ data }) => ({ id: 'booking', ...data }) },
        });
      },
    };
    const bookings = new BookingsService(prisma, { sendMail: async () => ({ success: true }) }, gateway);
    const attendee = { name: 'Test Attendee', email: 'test@example.com' };
    const result = await bookings.createBooking('test', attendee);
    assert.equal(result.status, 'confirmed');
    assert.equal(result.paymentMethod, 'free');
    assert.equal(transactions, 1);
    event.eventType = 'paid';
    event.price = 100;
    await assert.rejects(() => bookings.createBooking('test', attendee), /Paid registration is unavailable/);
    assert.equal(transactions, 1);
  } finally {
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key];
      else process.env[key] = saved[index];
    });
  }
});
