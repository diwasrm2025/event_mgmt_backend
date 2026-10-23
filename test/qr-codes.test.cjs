require('ts-node/register'); require('reflect-metadata');
const { test } = require('node:test'); const assert = require('node:assert/strict');
const { QrCodesService } = require('../src/qr-codes/qr-codes.service');
const { QrCodeDto } = require('../src/qr-codes/qr-codes.dto');
const { plainToInstance } = require('class-transformer'); const { validate } = require('class-validator');
const user = { id: 'user1', roleName: 'ORGANIZER' };
for (const roleName of ['ORGANIZER', 'ATTENDEE', 'SUPER_ADMIN']) test(roleName + ' list/edit/delete use correct ownership scope', async () => {
 const calls = []; const service = new QrCodesService({ qrCode: { findMany: async args => { calls.push(args); return []; }, updateMany: async args => { calls.push(args); return {count:1}; }, deleteMany: async args => { calls.push(args); return {count:1}; } } });
 const actor = { ...user, roleName }; await service.list(actor); await service.update(actor, 'qr', { title:' Title ',url:' https://example.com ' }); await service.remove(actor,'qr');
 assert.deepEqual(calls[0].where, roleName === 'SUPER_ADMIN' ? {} : {ownerId:'user1'});
 for (const call of calls.slice(1)) assert.deepEqual(call.where, roleName === 'SUPER_ADMIN' ? {id:'qr'} : {id:'qr',ownerId:'user1'});
 assert.deepEqual(calls[1].data, {title:'Title',url:'https://example.com'});
});
test('create assigns authenticated user and inaccessible mutations return not found', async()=> {
 let data; const service = new QrCodesService({qrCode:{create:async args=>{data=args.data;},updateMany:async()=>({count:0}),deleteMany:async()=>({count:0})}});
 await service.create(user,{title:' Title ',url:' https://example.com '}); assert.equal(data.ownerId,user.id);
 await assert.rejects(service.update(user,'other',{title:'Title',url:'https://example.com'}), /not found/); await assert.rejects(service.remove(user,'other'), /not found/);
});
test('URL validation rejects unsafe schemes and empty titles',async()=> {
 for(const url of ['https://example.com/a?b=1','http://localhost:3000']) assert.equal((await validate(plainToInstance(QrCodeDto,{title:' QR ',url}))).length,0);
 for(const url of ['javascript:alert(1)','ftp://example.com','example.com','data:text/plain,test']) assert.ok((await validate(plainToInstance(QrCodeDto,{title:'QR',url}))).length);
 assert.ok((await validate(plainToInstance(QrCodeDto,{title:'   ',url:'https://example.com'}))).length);
});
