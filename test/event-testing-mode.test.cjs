require('ts-node/register');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { EventsService } = require('../src/events/events.service');
const { BookingsService } = require('../src/bookings/bookings.service');
const { UpdateRegistrationStatusDto, REGISTRATION_STATUSES } = require('../src/bookings/dto/update-registration-status.dto');
const { validate } = require('class-validator');

test('switching event status into and out of testing manages preview tokens', async () => {
  const event = {
    id: 'event', title: 'Preview', status: 'draft', previewToken: null,
    ownerId: 'owner', attendees: 0, capacity: 5, eventType: 'free', price: 0,
  };
  let updateData;
  const prisma = {
    event: {
      findUnique: async () => ({ ...event }),
      update: async ({ data }) => { updateData = data; Object.assign(event, data); return { ...event }; },
    },
    activity: { create: async () => ({}) },
  };
  const service = new EventsService(prisma, {});
  await service.update('event', { status: 'testing' }, 'owner');
  assert.ok(event.previewToken);
  assert.equal(event.status, 'testing');
  const firstPreviewToken = event.previewToken;

  await service.update('event', { status: 'published' }, 'owner');
  assert.equal(updateData.previewToken, null);
  assert.equal(event.previewToken, null);
  await service.update('event', { status: 'testing' }, 'owner');
  assert.ok(event.previewToken);
  assert.notEqual(event.previewToken, firstPreviewToken);
});

async function assertTestingRegistrationIsolated(environment) {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = environment;
  try {
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer();
    const event = {
      id: 'event', ownerId: 'owner', title: 'Preview', date: '', time: '', venue: '', slug: 'preview',
      previewToken: 'preview-token', status: 'testing', eventType: 'paid', price: 10, capacity: 1, attendees: 1,
      registrationDeadline: null, fields: [], permissions: [],
    };
    let created;
    const prisma = {
      event: { findFirst: async () => event, findUniqueOrThrow: async () => event },
      booking: { create: async ({ data }) => (created = { id: 'booking', paymentAccessToken: 'private', ...data }) },
      $transaction: async (callback) => callback(prisma),
    };
    const cloudinary = {
      uploadBuffer: async () => ({
        publicId: 'proof',
        secureUrl: 'https://res.cloudinary.com/test/image/authenticated/upload/v1/proof.png',
        format: 'png',
        version: 1,
        resourceType: 'image',
        deliveryType: 'authenticated',
      }),
    };
    const service = new BookingsService(
      prisma,
      { sendMail: async () => assert.fail('Test bookings must not send email') },
      {},
      cloudinary,
    );
    const booking = await service.createTestingBooking('preview', 'preview-token', {
      name: 'Tester',
      email: 'tester@example.com',
      paymentMethod: 'qr',
      transactionId: 'UTR123456',
      paymentProof: `data:image/png;base64,${image.toString('base64')}`,
    }, { id: 'owner', permissions: [] });
    assert.equal(created.isTest, true);
    assert.equal(booking.paymentStatus, 'pending');
    assert.equal(booking.paymentProof, null);
    assert.equal(event.attendees, 1);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
}

for (const environment of ['development', 'production']) {
  test(`testing registrations stay isolated when NODE_ENV is ${environment}`, async () => {
    await assertTestingRegistrationIsolated(environment);
  });
}

test('registration review does not treat the event testing status as a payment status', async () => {
  assert.deepEqual(REGISTRATION_STATUSES, ['pending', 'approved', 'rejected']);
  const dto = Object.assign(new UpdateRegistrationStatusDto(), { status: 'testing' });
  assert.ok((await validate(dto)).length > 0);
});
