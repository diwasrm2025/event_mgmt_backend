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
