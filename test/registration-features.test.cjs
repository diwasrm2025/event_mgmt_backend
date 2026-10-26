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
test('checkbox choice responses accept allowed selections and reject invalid or missing required choices',()=>{
 const service = new BookingsService({}, {}, {}); const event = { fields:[{name:'diet',label:'Dietary needs',type:'checkbox',required:true,options:['Vegan','Gluten-free']}] };
 assert.doesNotThrow(()=>service.validateResponses(event,{diet:['Vegan','Gluten-free']}));
 assert.throws(()=>service.validateResponses(event,{diet:['Other']}),/listed choices/);
 assert.throws(()=>service.validateResponses(event,{diet:[]}),/is required/);
});

test('single checkboxes normalize legacy answers without bypassing required confirmation', () => {
 const service = new BookingsService({}, {}, {});
 const field = {name:'games',label:'Games for Bubbles (3-6 Years)',type:'checkbox',required:false,options:[]};
 for (const [input, expected] of [[true,true],[false,false],['true',true],['false',false],['',false],[null,false]]) {
  const responses = {games:input};
  assert.doesNotThrow(()=>service.validateResponses({fields:[field]},responses));
  assert.equal(responses.games,expected);
 }
 assert.doesNotThrow(()=>service.validateResponses({fields:[field]},{}));
 for (const input of [false,'false','',null,undefined]) {
  assert.throws(()=>service.validateResponses({fields:[{...field,required:true}]},{games:input}),/must be confirmed/);
 }
 for (const input of ['on','Other',[],1]) {
  assert.throws(()=>service.validateResponses({fields:[field]},{games:input}),/must be a checkbox value/);
 }
 const responses = {games:'true'};
 assert.doesNotThrow(()=>service.validateResponses({fields:[{...field,required:true}]},responses));
 assert.equal(responses.games,true);
});
