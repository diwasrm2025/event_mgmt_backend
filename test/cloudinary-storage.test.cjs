require('ts-node/register');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { CloudinaryService } = require('../src/common/cloudinary/cloudinary.service');
const { v2: cloudinary } = require('cloudinary');
const { AuthService } = require('../src/auth/auth.service');
const { EventsService } = require('../src/events/events.service');
const { BookingsService } = require('../src/bookings/bookings.service');

test('Cloudinary upload fails explicitly when environment credentials are missing', async () => {
  const service = new CloudinaryService({ get: () => undefined });
  await assert.rejects(
    service.uploadBuffer(Buffer.from('file'), { folder: 'event-mgmt/test' }),
    (error) => error.getStatus() === 503 && /CLOUDINARY_CLOUD_NAME/.test(error.message),
  );
});

test('Cloudinary deletion parses normal and authenticated delivery URLs', async () => {
  const credentials = {
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
  };
  const service = new CloudinaryService({ get: (name) => credentials[name] });
  const originalDestroy = cloudinary.uploader.destroy;
  const deletions = [];
  cloudinary.uploader.destroy = async (publicId, options) => {
    deletions.push({ publicId, options });
    return { result: 'ok' };
  };
  try {
    assert.equal(
      await service.deleteImageByUrl('https://res.cloudinary.com/test-cloud/image/upload/v123/event-mgmt/banners/banner.webp'),
      true,
    );
    assert.equal(
      await service.deleteImageByUrl('https://res.cloudinary.com/test-cloud/image/authenticated/s--abc123--/v456/event-mgmt/payment-proofs/proof.png'),
      true,
    );
    assert.deepEqual(deletions.map(({ publicId }) => publicId), [
      'event-mgmt/banners/banner',
      'event-mgmt/payment-proofs/proof',
    ]);
    assert.equal(deletions[0].options.type, 'upload');
    assert.equal(deletions[1].options.type, 'authenticated');
  } finally {
    cloudinary.uploader.destroy = originalDestroy;
  }
});

test('avatar replacement deletes the previous Cloudinary image', async () => {
  const previousUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v123/event-mgmt/avatars/old.webp';
  const deleted = [];
  const user = {
    id: 'user',
    name: 'Member',
    email: 'member@example.com',
    avatarUrl: 'https://res.cloudinary.com/test-cloud/image/upload/v124/event-mgmt/avatars/new.png',
    role: { name: 'ATTENDEE', permissions: [] },
  };
  const prisma = {
    user: {
      findUnique: async () => ({ avatarUrl: previousUrl }),
      update: async () => user,
    },
  };
  const cloudinaryMock = {
    uploadBuffer: async () => ({ secureUrl: user.avatarUrl, publicId: 'event-mgmt/avatars/new', deliveryType: 'upload' }),
    deleteImageByUrl: async (url) => { deleted.push(url); return true; },
  };
  const service = new AuthService(prisma, {}, cloudinaryMock);
  const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer();
  await service.uploadAvatar('user', { buffer });
  assert.deepEqual(deleted, [previousUrl]);
});

test('event banner replacement and removal delete the removed Cloudinary image', async () => {
  const oldUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v123/event-mgmt/banners/old.webp';
  const keptUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v124/event-mgmt/banners/kept.webp';
  const event = {
    id: 'event', title: 'Event', status: 'draft', banners: [oldUrl, keptUrl],
    capacity: 2, attendees: 0, eventType: 'free', price: 0,
  };
  const deleted = [];
  const prisma = {
    event: {
      findUnique: async () => ({ ...event }),
      update: async ({ data }) => { Object.assign(event, data); return { ...event }; },
    },
    activity: { create: async () => ({}) },
  };
  const service = new EventsService(prisma, {
    deleteImageByUrl: async (url) => { deleted.push(url); return true; },
  });
  await service.update('event', { banners: [keptUrl] }, 'owner');
  await service.removeBanner('event', keptUrl);
  assert.deepEqual(deleted, [oldUrl, keptUrl]);
  assert.deepEqual(event.banners, []);
});

test('booking deletion removes its authenticated payment proof from Cloudinary', async () => {
  const deletions = [];
  const prisma = {
    $transaction: async (callback) => callback({
      booking: {
        findFirst: async () => ({
          id: 'booking', paymentMethod: 'qr', paymentStatus: 'pending', isTest: false,
          status: 'pending', registrationStatus: 'pending', paymentProofPublicId: 'event-mgmt/payment-proofs/proof',
          event: { attendees: 0, capacity: 2, status: 'published' },
        }),
        delete: async () => {},
      },
      event: { update: async () => {} },
    }),
  };
  const service = new BookingsService(prisma, {}, {}, {
    deleteByPublicId: async (...args) => { deletions.push(args); },
  });
  await service.deleteBooking('event', 'booking');
  assert.deepEqual(deletions, [['event-mgmt/payment-proofs/proof', 'image', 'authenticated']]);
});
