require('ts-node/register');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { EventsService } = require('../src/events/events.service');

test('card image replaces a single image without changing detail banners and can be removed', async () => {
  let event = { id: 'event', cardImage: 'https://res.cloudinary.com/old.webp', banners: Array(8).fill('banner.webp') };
  const deleted = [];
  const service = new EventsService({ event: {
    findUnique: async () => event,
    update: async ({ data }) => (event = { ...event, ...data }),
  } }, {
    uploadBuffer: async () => ({ secureUrl: 'https://res.cloudinary.com/new.webp', publicId: 'new' }),
    deleteImageByUrl: async url => { deleted.push(url); return true; },
  });
  const file = { buffer: await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer() };
  const result = await service.addBanner('event', file, true);
  assert.equal(result.cardImage, 'https://res.cloudinary.com/new.webp');
  assert.equal(result.banners.length, 8);
  assert.deepEqual(deleted, ['https://res.cloudinary.com/old.webp']);
  await service.removeCardImage('event');
  assert.equal(event.cardImage, '');
  assert.equal(deleted[1], 'https://res.cloudinary.com/new.webp');
});

test('duplication creates an independent copy of the card image', async () => {
  const source = { id: 'source', title: 'Event', cardImage: 'https://res.cloudinary.com/source.webp', banners: [], agenda: [], fields: [] };
  const service = new EventsService({ event: {
    findUnique: async () => source,
    create: async ({ data }) => ({ id: 'copy', ...data }),
  }, activity: { create: async () => ({}) } }, {
    copyImageFromUrl: async () => ({ secureUrl: 'https://res.cloudinary.com/copy.webp' }),
  });
  const result = await service.duplicate('source', { id: 'owner' });
  assert.equal(result.cardImage, 'https://res.cloudinary.com/copy.webp');
  assert.deepEqual(result.banners, []);
  assert.equal(source.cardImage, 'https://res.cloudinary.com/source.webp');
});
