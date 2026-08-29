import { SetMetadata } from '@nestjs/common';
import { EventPermissionValue } from '../permissions';

export const EVENT_ACCESS_KEY = 'requiredEventAccess';

/**
 * Marks a route as requiring the given capability (VIEW | ATTENDEE | EDIT)
 * on the event identified by the `:id` route param (or a different param
 * name, if passed). Enforced by EventAccessGuard, which checks — in order —
 * Super Admin (events:manage_all), event ownership, then an active
 * EventPermission grant that includes this capability.
 */
export const RequireEventAccess = (capability: EventPermissionValue, paramName = 'id') =>
  SetMetadata(EVENT_ACCESS_KEY, { capability, paramName });
