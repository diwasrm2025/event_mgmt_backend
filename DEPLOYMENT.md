# Updating the production API

Run these commands from `backend` with the production environment configured:

```sh
npm ci
npm run deploy:prepare
```

`deploy:prepare` applies committed Prisma migrations, regenerates the Prisma
client, and compiles the NestJS API. Build tooling must be installed for this
step; do not omit development dependencies until after the build.

Restart the existing API service/process after these commands succeed. For a
fresh process, the start command is `npm run start:prod`.

The frontend's `NEXT_PUBLIC_API_URL` must point at this updated API. If that
value changes, rebuild and redeploy the frontend as well.

## Render configuration

- Build command: `npm ci && npm run build`
- Pre-deploy command: `npm run prisma:deploy`
- Start command: `npm run start:prod`

If your service does not support a pre-deploy command, run migrations in the
build command: `npm ci && npm run deploy:prepare`.

Set payment credentials in the backend service's Render Environment settings:
`SBIEPAY_API_KEY`, `SBIEPAY_API_SECRET`, `SBIEPAY_ENCRYPTION_KEY`, and
`SBIEPAY_ENVIRONMENT` (`LIVE` or `SANDBOX`). A local `.env` file does not configure
the Render service. Missing credentials no longer stop the API from starting;
free registrations remain available, and paid registrations return an error
before creating an order.

The SBI SDK throws a plain object when required credentials are absent. With
eager initialization this can appear as `ERROR [ExceptionHandler] undefined`
during startup. The payment client now initializes only when needed.

## Event type errors

- `property eventType should not exist`: the running API validation DTO does
  not accept the field. Deploy the current backend and restart every API
  instance. The current create and update DTOs accept `free` and `paid`.
- Prisma/TypeScript says `eventType` does not exist: regenerate Prisma and
  rebuild with `npm run build`.
- Database says the `eventType` column does not exist: apply the committed
  `20261022000000_add_event_type` migration using `npm run prisma:deploy`.

The migration classifies existing events with a positive price as paid and
events with a zero price as free. Do not disable request validation to bypass
an outdated API deployment.

## Checkbox choices rejected in production

If a field such as `Games for Bubbles (3-6 Years)` has choices in the public
event response but registration returns `must be a checkbox value`, check the
running API deployment. Checkbox groups submit an array of selected option
strings; single checkboxes without options submit a boolean. The current
`src/bookings/bookings.service.ts` validates these separately.

Deploy the backend commit containing checkbox choice validation to the Render
service receiving the failed request. Use **Manual Deploy → Deploy latest
commit**, and confirm that the deployed commit contains the change. If Render
is already showing that commit, use **Clear build cache & deploy**. Confirm the
build and start commands above, and that every API instance uses the new build.
Restarting an old build alone does not compile or deploy local source changes.

Reload the registration page and retry. Do not convert game selections to a
boolean: that would discard which games the attendee selected.
