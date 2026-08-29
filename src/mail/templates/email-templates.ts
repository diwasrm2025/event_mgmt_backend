export interface PermissionEmailContext {
  recipientName: string;
  recipientEmail: string;
  inviterName?: string;
  inviterEmail?: string;
  eventTitle: string;
  eventDate?: string;
  eventVenue?: string;
  permissions?: string[];
  tempPassword?: string;
  ctaHref: string;
  loginHref?: string;
}

const PERMISSION_LABELS: Record<string, { label: string; desc: string; badgeColor: string }> = {
  'events:view': {
    label: 'View Access',
    desc: 'View event details, overview, and stats.',
    badgeColor: '#3b82f6',
  },
  'events:attendee': {
    label: 'Attendee Management',
    desc: 'Manage registrations, check-in attendees at the door, export rosters.',
    badgeColor: '#10b981',
  },
  'events:edit': {
    label: 'Edit Access',
    desc: 'Modify event details, schedule, custom registration fields, and settings.',
    badgeColor: '#8b5cf6',
  },
};

function formatPermissionsList(permissions: string[] = []): string {
  if (!permissions.length) return '<p style="color:#6b7280;font-size:14px;margin:0;">Standard View Access</p>';

  return permissions
    .map((perm) => {
      const meta = PERMISSION_LABELS[perm] || {
        label: perm,
        desc: 'Custom access capability',
        badgeColor: '#6d5ef8',
      };
      return `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-left: 4px solid ${meta.badgeColor}; padding: 12px 16px; border-radius: 8px; margin-bottom: 8px;">
          <div style="font-weight: 600; font-size: 14px; color: #111827;">${meta.label}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${meta.desc}</div>
        </div>
      `;
    })
    .join('');
}

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pulseframe Events</title>
</head>
<body style="margin: 0; padding: 0;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%); padding: 32px 36px; text-align: left;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <div style="display: inline-block; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 10px; padding: 6px 14px; font-weight: 700; font-size: 15px; color: #ffffff; letter-spacing: -0.02em;">
                      ⚡ Pulseframe Events
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px;border:1px solid #f3f3f3ff;margin:0;border-top:none;border-bottom:none">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 36px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">This automated notification was sent by <strong>Pulseframe Events Platform</strong>.</p>
              <p style="margin: 0;">You received this because access to an event was granted or modified for <strong>you</strong>.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/** Email sent when access is granted to a BRAND NEW user (creating their account) */
export function renderNewUserAccessGrantedEmail(ctx: PermissionEmailContext): string {
  const inviterText = ctx.inviterName
    ? `<strong>${ctx.inviterName}</strong> (${ctx.inviterEmail || ''})`
    : 'An organizer';

  const content = `
    <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
      Welcome to Pulseframe! 🎉
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Hello <strong>${ctx.recipientName}</strong>,<br>
      ${inviterText} has created a Pulseframe account for you and granted you access to manage the event <strong style="color: #4f46e5;">"${ctx.eventTitle}"</strong>.
    </p>

    <!-- Event Summary Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px;">Target Event</div>
      <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">${ctx.eventTitle}</div>
      ${ctx.eventDate ? `<div style="font-size: 13px; color: #475569;">📅 <strong>Date:</strong> ${ctx.eventDate}</div>` : ''}
      ${ctx.eventVenue ? `<div style="font-size: 13px; color: #475569; margin-top: 4px;">📍 <strong>Venue:</strong> ${ctx.eventVenue}</div>` : ''}
    </div>

    <!-- Credentials Box -->
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1d4ed8; margin-bottom: 12px;">
        🔑 Your Account Login Credentials
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #334155; width: 110px;"><strong>Email:</strong></td>
          <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-family: monospace; background: #ffffff; padding: 4px 8px; border-radius: 4px; border: 1px solid #dbeafe;">${ctx.recipientEmail}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #334155;"><strong>Password:</strong></td>
          <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-family: monospace; background: #ffffff; padding: 4px 8px; border-radius: 4px; border: 1px solid #dbeafe;">${ctx.tempPassword || 'Password123!'}</td>
        </tr>
      </table>
      <div style="margin-top: 12px; font-size: 12px; color: #1e40af; line-height: 1.4;">
        ⚠️ For security reasons, we recommend changing your password after your first sign-in.
      </div>
    </div>

    <!-- Granted Permissions -->
    <div style="margin-bottom: 28px;">
      <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px;">Granted Capabilities:</div>
      ${formatPermissionsList(ctx.permissions)}
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 32px 0 16px 0;">
      <a href="${ctx.loginHref || ctx.ctaHref}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);">
        Log In &amp; Access Event →
      </a>
    </div>
  `;

  return baseLayout(content);
}

/** Email sent when access is granted to an EXISTING user */
export function renderExistingUserAccessGrantedEmail(ctx: PermissionEmailContext): string {
  const inviterText = ctx.inviterName
    ? `<strong>${ctx.inviterName}</strong> (${ctx.inviterEmail || ''})`
    : 'An organizer';

  const content = `
    <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
      Access Granted to "${ctx.eventTitle}" 🚀
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Hello <strong>${ctx.recipientName}</strong>,<br>
      ${inviterText} has granted you access to collaborate on the event <strong style="color: #4f46e5;">"${ctx.eventTitle}"</strong>.
    </p>

    <!-- Event Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px;">Event Overview</div>
      <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">${ctx.eventTitle}</div>
      ${ctx.eventDate ? `<div style="font-size: 13px; color: #475569;">📅 <strong>Date:</strong> ${ctx.eventDate}</div>` : ''}
      ${ctx.eventVenue ? `<div style="font-size: 13px; color: #475569; margin-top: 4px;">📍 <strong>Venue:</strong> ${ctx.eventVenue}</div>` : ''}
    </div>

    <!-- Granted Permissions -->
    <div style="margin-bottom: 28px;">
      <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px;">Your Granted Capabilities:</div>
      ${formatPermissionsList(ctx.permissions)}
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 32px 0 16px 0;">
      <a href="${ctx.ctaHref}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);">
        Open Event in Dashboard →
      </a>
    </div>
  `;

  return baseLayout(content);
}

/** Email sent when access permissions are UPDATED */
export function renderAccessUpdatedEmail(ctx: PermissionEmailContext): string {
  const inviterText = ctx.inviterName ? `<strong>${ctx.inviterName}</strong>` : 'An organizer';

  const content = `
    <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
      Event Access Updated ✏️
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Hello <strong>${ctx.recipientName}</strong>,<br>
      ${inviterText} has updated your permissions for <strong style="color: #4f46e5;">"${ctx.eventTitle}"</strong>.
    </p>

    <div style="margin-bottom: 28px;">
      <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px;">Your Updated Capabilities:</div>
      ${formatPermissionsList(ctx.permissions)}
    </div>

    <div style="text-align: center; margin: 32px 0 16px 0;">
      <a href="${ctx.ctaHref}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);">
        View Dashboard →
      </a>
    </div>
  `;

  return baseLayout(content);
}

/** Email sent when access is REVOKED or user REMOVED */
export function renderAccessRevokedEmail(ctx: PermissionEmailContext): string {
  const inviterText = ctx.inviterName ? `<strong>${ctx.inviterName}</strong>` : 'An organizer';

  const content = `
    <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
      Access Revoked
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Hello <strong>${ctx.recipientName}</strong>,<br>
      ${inviterText} has removed your access permissions for the event <strong>"${ctx.eventTitle}"</strong>.
    </p>
    <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
      If you believe this was done in error, please reach out directly to the event owner.
    </p>
    <div style="text-align: center; margin: 32px 0 16px 0;">
      <a href="${ctx.ctaHref}" style="display: inline-block; background: #475569; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">
        Go to Pulseframe Dashboard
      </a>
    </div>
  `;

  return baseLayout(content);
}

// ============================================================
// TICKET EMAIL — sent to attendee after successful booking
// ============================================================

export interface BookingTicketEmailContext {
  name: string;
  email: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  seats: number;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  bookingId: string;
  appUrl: string;
}

function format12hr(time: string): string {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function bookingTicketEmail(ctx: BookingTicketEmailContext): string {
  const isFree = ctx.amount <= 0;
  const formattedTime = format12hr(ctx.eventTime);

  const content = `
    <!-- Ticket Header -->
    <div style="text-align:center; margin-bottom:28px;">
      <div style="display:inline-block; background:linear-gradient(135deg,#6d28d9,#7c3aed); border-radius:50%; width:64px; height:64px; line-height:64px; font-size:28px; margin-bottom:12px;">🎟️</div>
      <h1 style="margin:0 0 6px; font-size:26px; font-weight:800; color:#0f172a; letter-spacing:-0.03em;">Booking Confirmed!</h1>
      <p style="margin:0; font-size:15px; color:#475569;">Hi <strong>${ctx.name}</strong>, your ticket is ready.</p>
    </div>

    <!-- Event Info Card -->
    <div style="background:linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%); border:1.5px solid #c4b5fd; border-radius:16px; padding:24px; margin-bottom:24px;">
      <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#7c3aed; margin-bottom:8px;">📍 Your Event</div>
      <div style="font-size:22px; font-weight:800; color:#0f172a; margin-bottom:14px; line-height:1.2;">${ctx.eventTitle}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding:5px 0; font-size:13px; color:#475569; width:90px;">📅 Date</td>
          <td style="padding:5px 0; font-size:13px; font-weight:600; color:#1e293b;">${ctx.eventDate}</td>
        </tr>
        ${formattedTime ? `<tr>
          <td style="padding:5px 0; font-size:13px; color:#475569;">🕐 Time</td>
          <td style="padding:5px 0; font-size:13px; font-weight:600; color:#1e293b;">${formattedTime}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:5px 0; font-size:13px; color:#475569;">📍 Venue</td>
          <td style="padding:5px 0; font-size:13px; font-weight:600; color:#1e293b;">${ctx.eventVenue}</td>
        </tr>
        <tr>
          <td style="padding:5px 0; font-size:13px; color:#475569;">🎫 Seats</td>
          <td style="padding:5px 0; font-size:13px; font-weight:600; color:#1e293b;">${ctx.seats} seat${ctx.seats > 1 ? 's' : ''}</td>
        </tr>
      </table>
    </div>

    <!-- Payment Summary -->
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin-bottom:24px;">
      <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#64748b; margin-bottom:12px;">💳 Payment Summary</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size:14px; color:#475569; padding:4px 0;">Amount</td>
          <td style="font-size:14px; font-weight:700; color:#0f172a; text-align:right; padding:4px 0;">${isFree ? 'Free' : formatINR(ctx.amount)}</td>
        </tr>
        <tr>
          <td style="font-size:14px; color:#475569; padding:4px 0;">Payment</td>
          <td style="font-size:14px; font-weight:600; color:#10b981; text-align:right; padding:4px 0;">✅ ${isFree ? 'No payment required' : ctx.paymentMethod.toUpperCase()}</td>
        </tr>
        ${ctx.transactionId ? `<tr>
          <td style="font-size:12px; color:#94a3b8; padding:4px 0;">Transaction ID</td>
          <td style="font-size:12px; color:#64748b; text-align:right; font-family:monospace; padding:4px 0;">${ctx.transactionId}</td>
        </tr>` : ''}
        <tr>
          <td style="font-size:12px; color:#94a3b8; padding:4px 0;">Booking ID</td>
          <td style="font-size:12px; color:#64748b; text-align:right; font-family:monospace; padding:4px 0;">${ctx.bookingId.slice(0, 8).toUpperCase()}</td>
        </tr>
      </table>
    </div>

    <!-- QR placeholder / reminder -->
    <div style="text-align:center; background:#fafafa; border:1px dashed #d1d5db; border-radius:12px; padding:18px; margin-bottom:24px;">
      <div style="font-size:32px; margin-bottom:6px;">📲</div>
      <div style="font-size:13px; color:#64748b; font-weight:500;">Show this email at the venue for entry</div>
      <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Booking ref: <strong style="font-family:monospace; color:#475569;">${ctx.bookingId.slice(0, 8).toUpperCase()}</strong></div>
    </div>

    <p style="font-size:13px; color:#64748b; text-align:center; margin:0;">Questions? Reply to this email or contact the event organizer.</p>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ticket — ${ctx.eventTitle}</title>
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 20px 40px -15px rgba(0,0,0,0.15);">
          <tr>
            <td style="background:linear-gradient(135deg,#6d28d9 0%,#7c3aed 50%,#8b5cf6 100%); padding:28px 36px;">
              <div style="font-weight:800; font-size:16px; color:#fff; letter-spacing:-0.01em;">⚡ Pulseframe Events</div>
              <div style="font-size:12px; color:rgba(255,255,255,0.7); margin-top:4px;">Event Management Platform</div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc; padding:20px 36px; border-top:1px solid #f1f5f9; font-size:11px; color:#94a3b8; text-align:center; line-height:1.5;">
              <p style="margin:0;">Sent to <strong>${ctx.email}</strong> by Pulseframe Events Platform.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// ============================================================
// WELCOME NEW USER EMAIL
// ============================================================
export interface WelcomeEmailContext {
  name: string;
  email: string;
  appUrl: string;
  roleName?: string;
}

export function welcomeNewUserEmail(ctx: WelcomeEmailContext): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Welcome to Pulseframe</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:540px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px -15px rgba(0,0,0,0.12);">
        <tr><td style="background:linear-gradient(135deg,#6d28d9,#7c3aed,#8b5cf6);padding:30px 36px;">
          <div style="font-weight:800;font-size:16px;color:#fff;">⚡ Pulseframe Events</div>
        </td></tr>
        <tr><td style="padding:36px;">
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#0f172a;">Welcome aboard, ${ctx.name}! 🎉</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">Your Pulseframe account has been created. You now have access to the platform${ctx.roleName ? ` as a <strong>${ctx.roleName}</strong>` : ''}.</p>
          <div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:12px;padding:18px;margin-bottom:24px;">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#7c3aed;margin-bottom:8px;">Your Login</div>
            <div style="font-size:14px;color:#1e293b;margin-bottom:4px;">📧 <strong>Email:</strong> ${ctx.email}</div>
          </div>
          <div style="text-align:center;margin:28px 0 8px;">
            <a href="${ctx.appUrl}/signin" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#7c3aed);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:12px;box-shadow:0 4px 12px rgba(109,40,217,0.3);">Sign In to Dashboard →</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 36px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;text-align:center;">
          <p style="margin:0;">Sent to ${ctx.email} by Pulseframe Events Platform.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
  `;
}

// ============================================================
// ROLE UPDATE EMAIL — sent when a user's role changes
// ============================================================
export interface RoleUpdateEmailContext {
  name: string;
  email: string;
  oldRole?: string;
  newRole: string;
  appUrl: string;
}

export interface TicketEmailContext {
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  seats: number;
  bookingId: string;
  paymentStatus: string;
  paymentMethod?: string;
  transactionId?: string | null;
  ctaHref: string;
}

// ============================================================
// EVENT CONFIRMATION TICKET — "Live Pass" Design (2026 refresh)
// A completely new look: a die-cut admission-pass card with a
// notched perforation between the info stub and the gate-entry
// stub, a bold gradient hero (background only — all text stays
// solid/opaque per design guidelines), and a clean scannable
// entry block. Replaces the previous BookMyShow-style card.
// ============================================================

export function renderTicketEmail(ctx: TicketEmailContext): string {
  const isPaid = ctx.paymentStatus === 'paid';
  const statusLabel = isPaid ? 'Confirmed' : 'Pending Payment';
  const statusDot = isPaid ? '#22c55e' : '#f59e0b';
  const shortRef = ctx.bookingId.replace(/-/g, '').slice(0, 10).toUpperCase();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Pass — ${ctx.eventTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef0f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#eef0f4;padding:36px 16px;">
    <tr><td align="center">

      <!-- Wordmark -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin-bottom:18px;">
        <tr>
          <td style="font-size:13px;font-weight:800;letter-spacing:0.08em;color:#334155;text-transform:uppercase;">Pulseframe Events</td>
          <td align="right">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${statusDot};margin-right:6px;vertical-align:middle;"></span>
            <span style="font-size:12px;font-weight:700;color:#334155;vertical-align:middle;letter-spacing:0.02em;">${statusLabel}</span>
          </td>
        </tr>
      </table>

      <!-- Die-cut Pass Card -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border-radius:24px;box-shadow:0 30px 60px -20px rgba(15,23,42,0.35);">

        <!-- Hero stub: gradient background, opaque solid-color text -->
        <tr>
          <td style="border-radius:24px 24px 0 0;background-image:linear-gradient(135deg,#111827 0%,#312e81 55%,#7e22ce 100%);padding:34px 32px 78px;position:relative;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#c4b5fd;margin-bottom:10px;">Admission Pass</div>
            <div style="font-size:25px;font-weight:800;line-height:1.25;color:#ffffff;letter-spacing:-0.01em;">${ctx.eventTitle}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
              <tr>
                <td style="padding-right:22px;">
                  <div style="font-size:10px;color:#c7d2fe;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;">Date</div>
                  <div style="font-size:13px;font-weight:700;color:#ffffff;">${ctx.eventDate || 'TBA'}</div>
                </td>
                ${ctx.eventTime ? `<td style="padding-right:22px;">
                  <div style="font-size:10px;color:#c7d2fe;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;">Time</div>
                  <div style="font-size:13px;font-weight:700;color:#ffffff;">${ctx.eventTime}</div>
                </td>` : ''}
                <td>
                  <div style="font-size:10px;color:#c7d2fe;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;">Venue</div>
                  <div style="font-size:13px;font-weight:700;color:#ffffff;">${ctx.eventVenue || 'Online / TBA'}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Notch row simulating a die-cut perforation between stubs -->
        <tr>
          <td style="background-color:#ffffff;padding:0;line-height:0;font-size:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:22px;height:22px;background-color:#eef0f4;border-radius:0 0 22px 0;"></td>
                <td style="border-top:2px dashed #e2e8f0;"></td>
                <td style="width:22px;height:22px;background-color:#eef0f4;border-radius:0 0 0 22px;"></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Attendee + Seat stub -->
        <tr>
          <td style="padding:26px 32px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:60%;vertical-align:top;">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:5px;">Attendee</div>
                  <div style="font-size:15px;font-weight:700;color:#0f172a;">${ctx.attendeeName}</div>
                  <div style="font-size:12px;color:#64748b;margin-top:3px;">${ctx.attendeeEmail}</div>
                  ${ctx.attendeePhone ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${ctx.attendeePhone}</div>` : ''}
                </td>
                <td style="width:40%;vertical-align:top;text-align:right;">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:5px;">Seats</div>
                  <div style="font-size:22px;font-weight:800;color:#7e22ce;">${ctx.seats}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Reference chips -->
        <tr>
          <td style="padding:16px 32px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#f8fafc;border:1px solid #eef0f4;border-radius:10px;padding:10px 14px;">
                  <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Booking Ref</div>
                  <div style="font-size:13px;font-weight:700;color:#0f172a;font-family:monospace;margin-top:2px;">${shortRef}</div>
                </td>
                <td style="width:12px;"></td>
                <td style="background-color:#f8fafc;border:1px solid #eef0f4;border-radius:10px;padding:10px 14px;">
                  <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Payment</div>
                  <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;">${ctx.paymentMethod ? ctx.paymentMethod.toUpperCase() : 'FREE'}</div>
                </td>
              </tr>
            </table>
            ${ctx.transactionId ? `<div style="font-size:11px;color:#94a3b8;margin-top:10px;">Transaction ID: <span style="font-family:monospace;color:#64748b;">${ctx.transactionId}</span></div>` : ''}
          </td>
        </tr>

        <!-- Scan block -->
        <tr>
          <td style="padding:22px 32px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;border-radius:16px;">
              <tr>
                <td style="padding:20px 22px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">Scan at Entry</div>
                        <div style="font-size:12px;color:#cbd5e1;">Show this pass on your phone at the venue gate.</div>
                      </td>
                      <td align="right" style="vertical-align:middle;width:96px;">
                        <div style="background-color:#ffffff;border-radius:8px;padding:8px;display:inline-block;">
                          <div style="font-family:monospace;font-size:18px;font-weight:900;letter-spacing:3px;color:#000000;line-height:1;">▌│▌▌│││▌│</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Guidelines -->
        <tr>
          <td style="padding:20px 32px 30px;">
            <ul style="margin:0;padding-left:18px;font-size:12px;color:#64748b;line-height:1.7;">
              <li>Gates open 30 minutes before the scheduled start time.</li>
              <li>Carry a valid photo ID matching the attendee name above.</li>
              <li>This pass is non-refundable and non-transferable.</li>
            </ul>
            <div style="text-align:center;margin-top:22px;">
              <a href="${ctx.ctaHref}" style="display:inline-block;background-image:linear-gradient(135deg,#4f46e5 0%,#7e22ce 100%);color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:13px 30px;border-radius:11px;letter-spacing:0.01em;">
                View &amp; Manage Pass →
              </a>
            </div>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin-top:18px;">
        <tr>
          <td align="center" style="font-size:11px;color:#94a3b8;line-height:1.6;">
            Sent to ${ctx.attendeeEmail} by Pulseframe Events Platform.
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>
  `;
}

export function roleUpdateEmail(ctx: RoleUpdateEmailContext): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Role Updated</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:540px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px -15px rgba(0,0,0,0.12);">
        <tr><td style="background:linear-gradient(135deg,#6d28d9,#7c3aed);padding:28px 36px;">
          <div style="font-weight:800;font-size:16px;color:#fff;">⚡ Pulseframe Events</div>
        </td></tr>
        <tr><td style="padding:36px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0f172a;">Your Role Has Been Updated 🔑</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">Hi <strong>${ctx.name}</strong>, an administrator has updated your role on the Pulseframe platform.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:24px;">
            ${ctx.oldRole ? `<div style="font-size:13px;color:#64748b;margin-bottom:8px;">Previous role: <span style="text-decoration:line-through;">${ctx.oldRole}</span></div>` : ''}
            <div style="font-size:16px;font-weight:700;color:#6d28d9;">New role: ${ctx.newRole}</div>
          </div>
          <div style="text-align:center;margin:24px 0 8px;">
            <a href="${ctx.appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#7c3aed);color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px;">Go to Dashboard →</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 36px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;text-align:center;">
          Sent to ${ctx.email} by Pulseframe Events Platform.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
  `;
}
