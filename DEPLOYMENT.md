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

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
`CLOUDINARY_API_SECRET` in the backend environment for both development and
production. Use the same Cloudinary product environment in both deployments.
The local `.env.example` lists these keys; do not commit `.env` or put Cloudinary
credentials in source code. New avatars, event banners, and payment screenshots
are stored in Cloudinary. Payment screenshots use authenticated delivery and
remain available only through the authorized backend proof route. Existing
`/uploads/...` URLs continue to be served for previously uploaded local media.
Apply the committed Cloudinary payment-proof migration with `npm run prisma:deploy`
before running the updated API.

Event testing previews are independent of `NODE_ENV`: an event must have status
`testing`, and its preview token remains restricted to the owner, super admin,
or an active event collaborator. Test bookings are marked `isTest`, do not
reserve live capacity, and do not send attendee or payment-review emails in
development or production.

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

## Event testing status rejected in production

The current backend accepts `testing` for event create, update, finalize, and
status-filter requests. If a response lists only `published`, `draft`,
`sold-out`, and `completed`, the production API is running an older build.
For the Render service, set **Root Directory** to `backend`, use build command
`npm ci && npm run build`, and start command `npm run start:prod`. Deploy the
latest backend source (use **Clear build cache & deploy** if the old response
continues), then retry the action. Rebuilding or changing only the frontend
cannot update the backend validator.

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
