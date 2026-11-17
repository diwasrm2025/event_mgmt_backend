require('ts-node/register');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { eventHasEnded, isCompletedEvent } = require('../src/events/event-lifecycle');
const { EventsService } = require('../src/events/events.service');

test('completion compares the scheduled time in India time at the exact boundary', () => {
  const event = { date: '2026-11-17', time: '14:00' };
  const boundary = Date.parse('2026-11-17T08:30:00Z');
  assert.equal(eventHasEnded(event, boundary - 1), false);
  assert.equal(eventHasEnded(event, boundary), true);
  assert.equal(eventHasEnded(event, boundary + 1), true);
  assert.equal(eventHasEnded({ ...event, time: '2:00 PM' }, boundary), true);
  assert.equal(eventHasEnded({ ...event, time: '12:00 AM' }, Date.parse('2026-11-16T18:30:00Z')), true);
  assert.equal(eventHasEnded({ ...event, time: '12:00 PM' }, Date.parse('2026-11-17T06:30:00Z')), true);
});

test('missing schedules remain current and dates without a time finish at day end', () => {
  const now = Date.parse('2026-11-17T08:30:00Z');
  assert.equal(eventHasEnded({ date: '', time: '' }, now), false);
  assert.equal(eventHasEnded({ date: '2026-11-17', time: 'invalid' }, now), false);
  assert.equal(eventHasEnded({ date: '2026-11-17', time: '' }, now), false);
  assert.equal(eventHasEnded({ date: '2026-11-16', time: '' }, now), true);
  assert.equal(isCompletedEvent({ date: '2027-01-01', status: 'completed' }, now), true);
});

test('lifecycle completes past events of all statuses and preserves history and banners', async () => {
  const updates = [];
  const prisma = { event: {
    findMany: async () => [
      { id: 'past', date: '2000-01-01', time: '10:00', banners: ['keep.png'] },
      { id: 'future', date: '2999-01-01', time: '10:00', banners: [] },
      { id: 'unscheduled', date: '', time: '', banners: [] },
    ],
    update: async (args) => { updates.push(args); return args.data; },
  }};
  assert.deepEqual(await new EventsService(prisma, {}).autoCompletePastEvents(), { completed: 1 });
  assert.deepEqual(updates, [{ where: { id: 'past' }, data: { status: 'completed' } }]);
});
