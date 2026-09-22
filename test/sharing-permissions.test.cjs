require('ts-node/register');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { BookingsController, rosterCapabilities } = require('../src/bookings/bookings.controller');
const { BookingsService } = require('../src/bookings/bookings.service');
const { PrismaService } = require('../src/prisma/prisma.service');
const { JwtAuthGuard } = require('../src/auth/guards/jwt-auth.guard');
const { EventAccessGuard } = require('../src/common/guards/event-access.guard');
const { EVENT_PERMISSION } = require('../src/common/permissions');
const { validate } = require('class-validator');
const { GrantPermissionDto } = require('../src/event-permissions/dto/grant-permission.dto');

for (const [permissions, payment, checkin] of [
  [['VIEW'], false, false], [['EDIT'], false, false], [['PAYMENT_APPROVE'], true, false], [['ATTENDEE'], false, true], [['PAYMENT_APPROVE', 'ATTENDEE'], true, true],
]) {
  test(`roster permissions and field selection: ${permissions.join('+')}`, async () => {
    const capabilities = rosterCapabilities({ permissions });
    assert.deepEqual(capabilities, { canApprovePayment: payment, canCheckIn: checkin });
    let selection;
    const service = new BookingsService({ booking: { findMany: async args => { selection = args.select; return []; } } }, {});
    await service.roster('event', capabilities);
    assert.equal(Boolean(selection.paymentProof), payment);
    assert.equal(Boolean(selection.transactionId), payment);
    assert.equal(Boolean(selection.checkedIn), checkin);
    assert.equal(selection.paymentAccessToken, undefined);
  });
}
test('payment approval is a valid sharing permission; unknown permissions are rejected', async () => {
  const dto = Object.assign(new GrantPermissionDto(), { email: 'member@example.com', permissions: [EVENT_PERMISSION.PAYMENT_APPROVE] });
  assert.equal((await validate(dto)).length, 0);
  dto.permissions = ['UNRECOGNIZED'];
  assert.ok((await validate(dto)).length > 0);
});
test('HTTP routes enforce independent view, payment approval, and check-in access', async () => {
  const prisma = {
    event: { findUnique: async () => ({ id: 'event', ownerId: 'owner' }) },
    eventPermission: { findUnique: async ({ where }) => {
      const id = where.eventId_userId.userId;
      return { status: id === 'revoked' ? 'REMOVED' : 'ACTIVE', permissions: id === 'both' ? ['PAYMENT_APPROVE', 'ATTENDEE'] : [id] };
    } },
  };
  const service = {
    roster: async (id, access) => [{ id: 'booking', name: 'Member', ...(access.canApprovePayment ? { paymentProof: 'private-proof' } : {}), ...(access.canCheckIn ? { checkedIn: false } : {}) }],
    toggleCheckIn: async () => ({ id: 'booking', checkedIn: true }),
    updateRegistrationStatus: async () => ({ id: 'booking', paymentStatus: 'paid', status: 'confirmed', registrationStatus: 'approved', event: { private: true }, paymentAccessToken: 'secret' }),
  };
  const module = await Test.createTestingModule({ controllers: [BookingsController], providers: [EventAccessGuard, { provide: PrismaService, useValue: prisma }, { provide: BookingsService, useValue: service }] })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: context => { const req = context.switchToHttp().getRequest(); req.user = { id: req.headers['x-test-role'], permissions: req.headers['x-test-role'] === 'super' ? ['events:manage_all'] : [] }; return Boolean(req.user.id); } }).compile();
  const app = module.createNestApplication();
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  try {
    for (const [role, payment, checkin] of [['VIEW', false, false], ['EDIT', false, false], ['PAYMENT_APPROVE', true, false], ['ATTENDEE', false, true], ['both', true, true], ['owner', true, true], ['super', true, true]]) {
      const headers = { 'x-test-role': role, 'Content-Type': 'application/json' };
      const roster = await fetch(`${base}/bookings/event/event`, { headers });
      assert.equal(roster.status, 200, `${role} can view roster`);
      const payload = await roster.json();
      assert.equal(Boolean(payload.items[0].paymentProof), payment);
      assert.equal('checkedIn' in payload.items[0], checkin);
      const approval = await fetch(`${base}/bookings/event/event/booking/registration-status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'approved' }) });
      assert.equal(approval.status, payment ? 200 : 403, `${role} approval`);
      if (payment) { const result = await approval.json(); assert.equal(result.paymentAccessToken, undefined); assert.equal(result.event, undefined); }
      const check = await fetch(`${base}/bookings/event/event/booking/check-in`, { method: 'PATCH', headers });
      assert.equal(check.status, checkin ? 200 : 403, `${role} check-in`);
    }
    assert.equal((await fetch(`${base}/bookings/event/event`, { headers: { 'x-test-role': 'revoked' } })).status, 403);
    assert.equal((await fetch(`${base}/bookings/event/event`)).status, 403);
  } finally { await app.close(); }
});
