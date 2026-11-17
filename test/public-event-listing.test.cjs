require('ts-node/register');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PublicEventsService } = require('../src/public/public-events.service');
test('public listing excludes expired events even when their registration deadline passed', async () => {
  const base = { ownerId: 'owner', title: 'Event', venue: '', host: '', category: 'Music', time: '12:00' };
  let query;
  const service = new PublicEventsService({ event: { findMany: async (args) => {
    query = args;
    return [
      { ...base, id: 'expired', date: '2000-01-01', status: 'published', registrationDeadline: new Date('1999-01-01') },
      { ...base, id: 'completed', date: '2000-01-01', status: 'completed', registrationDeadline: new Date('1999-01-01') },
      { ...base, id: 'current', date: '2999-01-01', status: 'published', registrationDeadline: new Date('2000-01-01') },
    ];
  } } });
  const events = await service.findPublished({});
  assert.deepEqual(events.map(e => e.id), ['current']);
  assert.deepEqual(query.orderBy, { createdAt: 'desc' });
  assert.equal(events[0].ownerId, undefined);
});
