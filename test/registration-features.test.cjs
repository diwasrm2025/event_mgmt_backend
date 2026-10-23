require('ts-node/register');
require('reflect-metadata');
const { test } = require('node:test'); const assert = require('node:assert/strict');
const { ageThisYear, isDobField, registrationClosed } = require('../src/bookings/registration');
const { PublicEventsService } = require('../src/public/public-events.service');
const { BookingsService } = require('../src/bookings/bookings.service');
const { EventFieldsService } = require('../src/event-fields/event-fields.service');
test('age uses calendar year, validates leap days and rejects future DOB', () => {
 const now = new Date('2026-10-23T12:00:00Z'); assert.equal(ageThisYear('2000-12-31', now), 26); assert.equal(ageThisYear('2000-02-29', now), 26);
 for(const value of ['2026-02-29', '2026-10-24', 'invalid']) assert.equal(ageThisYear(value, now), null);
 assert.equal(isDobField({ type:'date', name:'dob', label:'Birth date' }), true); assert.equal(isDobField({ type:'date', name:'arrival', label:'Arrival' }), false);
});
test('deadline closes exactly at cutoff and public response hides all details', async () => {
 const cutoff = '2026-10-23T12:00:00Z'; assert.equal(registrationClosed({ registrationDeadline:cutoff }, Date.parse(cutoff)-1), false); assert.equal(registrationClosed({ registrationDeadline:cutoff }, Date.parse(cutoff)), true);
 const service = new PublicEventsService({ event:{ findFirst:async()=>({id:'e',slug:'event',ownerId:'owner',title:'Secret',description:'Private',fields:[{label:'Question'}],registrationDeadline:new Date(0)}) } });
 const result = await service.findBySlug('event'); assert.equal(result.registrationClosed,true); assert.equal(result.title,undefined); assert.equal(result.fields,undefined);
});
for(const eventType of ['free','paid']) test(eventType + ' cannot register after deadline', async()=>{
 const service = new BookingsService({ event:{ findFirst:async()=>({id:'e',eventType,status:'published',registrationDeadline:new Date(0),fields:[]}) } }, {}, {});
 await assert.rejects(service.createBooking('event',{name:'Test',email:'a@example.com'}), /registration has been closed/);
});
test('renaming a question preserves the response key', async()=>{
 let data; const service = new EventFieldsService({eventFormField:{findFirst:async()=>({id:'f',name:'old_question',label:'Old question'}),update:async args=>{data=args.data;return data;}}});
 await service.update('e','f',{label:'New question'}); assert.equal(data.label,'New question'); assert.equal(data.name,undefined);
});
