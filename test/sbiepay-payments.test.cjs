require('ts-node/register');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BookingsService } = require('../src/bookings/bookings.service');
const { SbiepayVerificationJob } = require('../src/bookings/sbiepay-verification.job');

function setup(price = 100) {
  const event = { id: 'event', title: 'Test event', eventType: price > 0 ? 'paid' : 'free', price, attendees: 0, capacity: 2, fields: [] };
  const state = { booking: null, emails: [], orders: [], searches: [], searchStatus: 'CREATED' };
  const db = {
    event: {
      findFirst: async () => event, findUniqueOrThrow: async () => event,
      update: async ({ data }) => { event.attendees += data.attendees.increment; return event; },
    },
    booking: {
      findUnique: async ({ where }) => state.booking && (!where.merchantOrderNumber || where.merchantOrderNumber === state.booking.merchantOrderNumber) ? { ...state.booking, event } : null,
      findFirst: async ({ where }) => state.booking && (!where.paymentAccessToken || where.paymentAccessToken === state.booking.paymentAccessToken) ? { ...state.booking, event } : null,
      create: async ({ data }) => (state.booking = { id: 'booking', paymentAccessToken: 'secret', ...data }),
      update: async ({ data }) => (state.booking = { ...state.booking, ...data, event }),
    },
    $transaction: async (callback) => callback(db),
  };
  const sbi = {
    createOrder: async (order) => { assert.equal(state.booking.merchantOrderNumber, order.orderRefNumber); state.orders.push(order); if (state.createError) throw new Error('timeout'); return { data: [{ sbiOrderRefNumber: 'SBI123', transactionUrl: 'https://payment.example/checkout' }] }; },
    searchOrder: async (query) => { state.searches.push(query); if (state.searchError) throw new Error('network unavailable'); if (state.nestedResponse) return { status: 1, data: [[{ orderInfo: { orderRefNumber: query.orderRefNumber, orderStatus: state.searchStatus, sbiOrderRefNumber: 'SBI123' }, paymentInfo: [{ orderAmount: query.orderAmount, atrnNumber: 'ATRN123', transactionStatus: 'SUCCESS', ...state.searchExtra }] }]] }; return { status: 200, data: [{ orderRefNumber: query.orderRefNumber, orderAmount: query.orderAmount, orderStatus: state.searchStatus, atrnNumber: 'ATRN123', ...state.searchExtra }] }; },
    decodeCallback: async () => ({ orderRefNumber: state.booking.merchantOrderNumber, orderStatus: 'SUCCESS' }),
  };
  const service = new BookingsService(db, { sendMail: async (...args) => { state.emails.push(args); return { success: true }; } }, sbi);
  const submit = (extra = {}) => service.createBooking('test', {
    name: 'Member',
    email: 'member@example.com',
    ...(event.eventType === 'paid' ? { paymentMethod: 'sbiepay' } : {}),
    ...extra,
  });
  return { service, state, event, submit, db };
}

test('SBI checkout persists a unique merchant reference before creating the order', async () => {
  const { submit, state, event } = setup(); const result = await submit();
  assert.match(result.booking.merchantOrderNumber, /^O[a-f0-9]{32}$/);
  assert.equal(result.booking.paymentMethod, 'sbiepay'); assert.equal(result.booking.paymentStatus, 'pending');
  assert.equal(result.booking.orderStatus, 'CREATED'); assert.equal(result.booking.paymentProof, null);
  assert.equal(result.transactionUrl, 'https://payment.example/checkout');
  assert.equal(state.booking.sbiOrderRefNumber, 'SBI123');
  assert.match(state.orders[0].returnUrl, /\/api\/bookings\/sbiepay\/callback$/);
  assert.equal(event.attendees, 0); assert.equal(state.emails.length, 0);
});

test('QR submissions are refused', async () => {
  const { submit } = setup(); await assert.rejects(submit({ paymentMethod: 'qr' }), /Only SBI/);
});

test('an uncertain create response retains a searchable order and private status token', async () => {
  const { submit, state } = setup(); state.createError = true; const result = await submit();
  assert.equal(result.paymentInitiationPending, true); assert.equal(result.booking.paymentAccessToken, 'secret');
  assert.ok(state.booking.merchantOrderNumber); assert.equal(state.booking.paymentStatus, 'pending');
});

for (const status of ['CREATED', 'ATTEMPTED', 'PENDING', 'UNKNOWN']) test(status + ' does not fulfill registration', async () => {
  const { submit, state, service, event } = setup(); await submit(); state.searchStatus = status;
  await service.verifySbiOrder('booking'); assert.equal(state.booking.orderStatus, status);
  assert.equal(state.booking.paymentStatus, 'pending'); assert.equal(event.attendees, 0); assert.equal(state.emails.length, 0);
});

test('SUCCESS alone confirms registration, counts seats once and sends one ticket', async () => {
  const { submit, state, service, event } = setup(); await submit(); state.searchStatus = 'SUCCESS';
  await service.verifySbiOrder('booking'); await service.verifySbiOrder('booking');
  assert.equal(state.booking.paymentStatus, 'paid'); assert.equal(state.booking.registrationStatus, 'approved');
  assert.equal(state.booking.transactionId, 'ATRN123'); assert.ok(state.booking.paidAt);
  assert.equal(event.attendees, 1); assert.equal(state.emails.length, 1); assert.equal(state.searches.length, 1);
  assert.equal(state.searches[0].orderAmount, 100); assert.equal(state.searches[0].sbiOrderRefNumber, 'SBI123');
});

for (const status of ['FAIL', 'FAILED']) test(status + ' ends verification without providing a ticket', async () => {
  const { submit, state, service, event } = setup(); await submit(); state.searchStatus = status;
  await service.verifySbiOrder('booking'); await service.verifySbiOrder('booking');
  assert.equal(state.booking.paymentStatus, 'failed'); assert.equal(state.booking.status, 'cancelled');
  assert.equal(event.attendees, 0); assert.equal(state.emails.length, 0); assert.equal(state.searches.length, 1);
});

test('amount or merchant reference mismatches stay pending', async () => {
  const { submit, state, service } = setup(); await submit(); state.searchStatus = 'SUCCESS';
  state.searchExtra = { orderAmount: 99 }; await assert.rejects(service.verifySbiOrder('booking'), /did not match/);
  state.searchExtra = { orderRefNumber: 'wrong' }; await assert.rejects(service.verifySbiOrder('booking'), /did not match/);
  assert.equal(state.booking.paymentStatus, 'pending'); assert.equal(state.emails.length, 0);
});

test('transaction status and API envelope cannot substitute for orderStatus', async () => {
  const { submit, state, service } = setup(); await submit(); state.searchStatus = 'ATTEMPTED';
  state.searchExtra = { transactionStatus: 'SUCCESS', status: 'SUCCESS' }; await service.verifySbiOrder('booking');
  assert.equal(state.booking.paymentStatus, 'pending');
});

test('SBI orders cannot be manually approved or rejected', async () => {
  const { submit, service } = setup(); await submit();
  await assert.rejects(service.updateRegistrationStatus('event', 'booking', { status: 'approved' }), /cannot be changed manually/);
  await assert.rejects(service.updateRegistrationStatus('event', 'booking', { status: 'rejected', reason: 'Reject' }), /cannot be changed manually/);
});

test('successful payment with exhausted capacity is recorded without supplying a ticket', async () => {
  const { submit, state, service, event } = setup(); await submit(); event.attendees = 2; state.searchStatus = 'SUCCESS';
  await service.verifySbiOrder('booking'); assert.equal(state.booking.paymentStatus, 'paid');
  assert.equal(state.booking.registrationStatus, 'pending'); assert.equal(state.emails.length, 0); assert.equal(event.attendees, 2);
});

test('free registrations remain immediate and status lookup requires a private token', async () => {
  const { submit, state, service, event } = setup(0);
  event.fields.push({ name: 'required_field', label: 'Required field', type: 'text', required: true, options: [] });
  await assert.rejects(submit(), /"Required field" is required/);
  await submit({ responses: { required_field: 'Attendee details' } });
  assert.equal(state.booking.paymentStatus, 'paid'); assert.equal(event.attendees, 1); assert.equal(state.emails.length, 1);
  assert.equal(state.orders.length, 0); assert.equal(state.booking.paymentMethod, 'free');
  assert.equal(state.booking.transactionId, null); assert.equal(state.booking.responses.required_field, 'Attendee details');
  await assert.rejects(service.paymentStatus('booking', ''), /not found/);
  await assert.rejects(service.paymentStatus('booking', 'wrong'), /not found/);
  await assert.rejects(service.createBooking('test', { name: 'Member', email: 'member@example.com', paymentMethod: 'sbiepay' }), /Free event registrations do not accept payment details/);
});

test('required checkbox registration fields accept boolean responses for free events', async () => {
  const { submit, state, event } = setup(0);
  event.fields.push({ name: 'consent', label: 'Consent', type: 'checkbox', required: true, options: [] });
  await assert.rejects(submit(), /"Consent" must be confirmed/);
  await assert.rejects(submit({ responses: { consent: 'true' } }), /"Consent" must be a checkbox value/);
  await submit({ responses: { consent: true } });
  assert.equal(state.booking.responses.consent, true);
  assert.equal(state.booking.paymentMethod, 'free');
  assert.equal(state.orders.length, 0);
});

test('callback SUCCESS cannot fulfill an ATTEMPTED order; verification failures still redirect to private status', async () => {
  const { submit, state, service } = setup(); await submit(); state.searchStatus = 'ATTEMPTED';
  let redirect;
  const response = { redirect: (code, url) => { redirect = { code, url }; }, status: () => ({ send: () => assert.fail('unexpected callback error') }) };
  await service.handleSbiEpayCallback({ body: { encData: 'encrypted' } }, response);
  assert.equal(state.booking.paymentStatus, 'pending'); assert.equal(redirect.code, 303);
  assert.match(redirect.url, /payment-status\/booking#token=secret$/);
  state.searchError = true; await service.handleSbiEpayCallback({ query: { encData: 'encrypted' } }, response);
  assert.equal(state.booking.paymentStatus, 'pending');
});

test('cron searches every batch, continues after one search failure and prevents overlapping runs', async () => {
  let calls = 0, nestedCalls = 0; const attempted = [];
  const db = { booking: { findMany: async (query) => {
    calls++; assert.equal(query.where.paymentStatus, 'pending'); assert.deepEqual(query.where.merchantOrderNumber, { not: null });
    return !query.cursor ? [{ id: 'a' }, { id: 'b' }] : query.cursor.id === 'b' ? [{ id: 'c' }] : [];
  } } };
  const job = new SbiepayVerificationJob(db, { verifySbiOrder: async id => {
    attempted.push(id); await job.verifyUnresolvedOrders(); nestedCalls++;
    if (id === 'a') throw new Error('temporary error');
  } });
  await job.verifyUnresolvedOrders(); assert.deepEqual(attempted, ['a', 'b', 'c']); assert.equal(calls, 3); assert.equal(nestedCalls, 3);
  attempted.length = 0; await job.verifyUnresolvedOrders(); assert.deepEqual(attempted, ['a', 'b', 'c']);
});

 test('actual SBI nested PAID response updates the order and confirms payment once', async () => {
  const { submit, state, service, event } = setup(); await submit(); state.nestedResponse = true; state.searchStatus = 'PAID';
  await service.verifySbiOrder('booking'); await service.verifySbiOrder('booking');
  assert.equal(state.booking.orderStatus, 'PAID'); assert.equal(state.booking.paymentStatus, 'paid');
  assert.equal(state.booking.registrationStatus, 'approved'); assert.equal(state.booking.status, 'confirmed');
  assert.equal(state.booking.transactionId, 'ATRN123'); assert.equal(event.attendees, 1); assert.equal(state.emails.length, 1);
});
 test('nested transaction SUCCESS cannot fulfill an ATTEMPTED order', async () => {
  const { submit, state, service } = setup(); await submit(); state.nestedResponse = true; state.searchStatus = 'ATTEMPTED';
  await service.verifySbiOrder('booking'); assert.equal(state.booking.paymentStatus, 'pending'); assert.equal(state.emails.length, 0);
});
 test('nested PAID response with incorrect amount remains pending', async () => {
  const { submit, state, service } = setup(); await submit(); state.nestedResponse = true; state.searchStatus = 'PAID'; state.searchExtra = { orderAmount: 99 };
  await assert.rejects(service.verifySbiOrder('booking'), /did not match/); assert.equal(state.booking.paymentStatus, 'pending');
});
