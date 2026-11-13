require('ts-node/register');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { CreateEventDto, STATUSES } = require('../src/events/dto/create-event.dto');
const { FinalizeEventDto } = require('../src/events/dto/finalize-event.dto');
const { QueryEventsDto } = require('../src/events/dto/query-events.dto');
const { UpdateEventDto } = require('../src/events/dto/update-event.dto');

test('testing is accepted consistently by event create, update, finalize, and filter DTOs', async () => {
  assert.deepEqual(STATUSES, ['published', 'draft', 'testing', 'sold-out', 'completed']);
  const cases = [
    [CreateEventDto, { title: 'Preview event', status: 'testing' }],
    [UpdateEventDto, { status: 'testing' }],
    [FinalizeEventDto, { status: 'testing' }],
    [QueryEventsDto, { status: 'testing' }],
  ];
  for (const [Dto, value] of cases) {
    assert.deepEqual(await validate(plainToInstance(Dto, value)), [], `${Dto.name} rejects testing status`);
  }
});
