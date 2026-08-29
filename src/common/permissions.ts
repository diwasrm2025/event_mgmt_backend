/**
 * Canonical permission strings. A Role's `permissions` array (stored in the
 * database) is made up of these. Never hardcode a permission string
 * elsewhere — always reference this map so a typo can't silently create an
 * unenforceable permission.
 */
export const PERMISSIONS = {
  // Event management
  EVENTS_CREATE: 'events:create',
  /** Bypasses ownership/EventPermission checks entirely — full access to
   *  every event in the system. Only SUPER_ADMIN should ever hold this. */
  EVENTS_MANAGE_ALL: 'events:manage_all',
  // User / role administration
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  // Company management
  COMPANIES_MANAGE: 'companies:manage',
} as const;

export type PermissionString = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Per-event access levels granted via the EventPermission table. A grant
 * holds a COMBINATION of these — e.g. ["VIEW", "ATTENDEE"] — matching the
 * spec's "View + Attendee", "Edit only", "All permissions", etc. The event
 * owner (and Super Admin) always implicitly has every capability; this only
 * describes what a *shared* member can do. */
export const EVENT_PERMISSION = {
  /** View event details only. Cannot edit, delete, manage attendees, or share. */
  VIEW: 'VIEW',
  /** Manage registrations: approve/reject, check attendees in/out, export the list. Cannot edit event content. */
  ATTENDEE: 'ATTENDEE',
  /** Edit event details, images, schedule. Cannot delete or manage sharing. */
  EDIT: 'EDIT',
} as const;

export type EventPermissionValue = (typeof EVENT_PERMISSION)[keyof typeof EVENT_PERMISSION];
export const ALL_EVENT_PERMISSIONS: EventPermissionValue[] = Object.values(EVENT_PERMISSION);

/** Grant statuses in the Shared Members list. ACTIVE grants actually confer
 * access; REMOVED is kept only as history after "Revoke Access" (as
 * opposed to "Remove Member", which deletes the row outright). */
export const GRANT_STATUS = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
} as const;

/** System role names. These three roles are seeded and cannot be deleted. */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORGANIZER: 'ORGANIZER',
  ATTENDEE: 'ATTENDEE',
} as const;

/** Definitions used by the seed script to create/update the system roles
 * idempotently on every deploy. */
export const SYSTEM_ROLE_DEFINITIONS: Array<{
  name: string;
  description: string;
  permissions: string[];
}> = [
  {
    name: SYSTEM_ROLES.SUPER_ADMIN,
    description: 'Full access to every event and all administrative functions.',
    permissions: [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_MANAGE_ALL,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.ROLES_MANAGE,
      PERMISSIONS.COMPANIES_MANAGE,
    ],
  },
  {
    name: SYSTEM_ROLES.ORGANIZER,
    description: 'Can create and manage their own events, and events shared with them.',
    permissions: [PERMISSIONS.EVENTS_CREATE],
  },
  {
    name: SYSTEM_ROLES.ATTENDEE,
    description: 'Signed-in visitor with no event-management permissions.',
    permissions: [],
  },
];
