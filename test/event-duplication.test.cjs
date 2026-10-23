require('ts-node/register'); require('reflect-metadata');
const { test } = require('node:test'); const assert = require('node:assert/strict');
const { EventsService } = require('../src/events/events.service');
const { CreateEventDto } = require('../src/events/dto/create-event.dto');
const { plainToInstance } = require('class-transformer'); const { validate } = require('class-validator');
test('duplicate copies editable configuration and fields into an independent empty draft', async () => {
 const source = { id:'original',title:'Event 1',slug:'event-1',status:'published',ownerId:'original-owner',attendees:10,category:'Gaming',date:'2027-01-01',time:'10:00',venue:'Hall',capacity:100,eventType:'paid',price:200,description:'About',agenda:['Welcome'],host:'Host',featured:true,eventMode:'offline',onlineUrl:'',registrationDeadline:new Date('2026-12-31'),companyId:null,banners:[],fields:[{id:'old-field',name:'name',label:'Question',type:'select',required:true,options:['One'],order:0}] };
 let data; const service = new EventsService({event:{findUnique:async()=>source,create:async args=>{data=args.data;return {id:'new',...data};}},activity:{create:async()=>({})}});
 const result = await service.duplicate('original',{id:'new-owner'});
 assert.equal(result.id,'new'); assert.equal(data.title,'Event 1 copy'); assert.equal(data.status,'draft'); assert.equal(data.slug,null); assert.equal(data.ownerId,'new-owner'); assert.equal(data.attendees,0);
 assert.equal(data.bookings,undefined); assert.equal(data.permissions,undefined); assert.equal(data.fields.create[0].id,undefined);
 data.fields.create[0].options.push('Two'); data.agenda.push('Closing'); assert.deepEqual(source.fields[0].options,['One']); assert.deepEqual(source.agenda,['Welcome']);
 assert.equal(data.registrationDeadline,source.registrationDeadline);
});
test('custom category is accepted and whitespace-only category rejected', async()=>{
 assert.equal((await validate(plainToInstance(CreateEventDto,{title:'Event',category:' Gaming '}))).length,0);
 assert.ok((await validate(plainToInstance(CreateEventDto,{title:'Event',category:'   '}))).length);
});
