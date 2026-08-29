import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as https from 'https';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private smtpTransporter: nodemailer.Transporter | null = null;
  private brevoApiKey: string | null = null;
  private brevoFromEmail: string;
  private brevoFromName: string;

  constructor() {
    const smtpHost = process.env.SMTP_HOST;
    const apiKey = process.env.BREVO_API_KEY;

    this.brevoFromEmail =
      process.env.MAIL_FROM ||
      process.env.BREVO_FROM_EMAIL ||
      process.env.SMTP_FROM ||
      'no-reply@pulseframe.app';
    this.brevoFromName = process.env.MAIL_FROM_NAME || 'Pulseframe Events';

    if (smtpHost) {
      const port = Number(process.env.SMTP_PORT) || 587;
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        ...(user && pass ? { auth: { user, pass } } : {}),
      });
      this.logger.log(
        `MailService initialized with SMTP transport (${smtpHost}:${port})`,
      );
    } else if (apiKey) {
      this.brevoApiKey = apiKey;
      this.logger.log(
        `MailService initialized with Brevo API (from: ${this.brevoFromEmail})`,
      );
    } else {
      this.logger.warn(
        'Neither SMTP_HOST nor BREVO_API_KEY is set — emails are logged to console in dev mode.',
      );
    }
  }

  /**
   * Sends a transactional email via SMTP (Nodemailer) or Brevo REST API.
   * Never throws — a failed mail send should never break the request that
   * triggered it (e.g. granting share access still succeeds even if the
   * email fails), so failures are logged instead.
   */
  async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string; skipped?: boolean }> {
    // ── SMTP path ──────────────────────────────────────────────────────────
    if (this.smtpTransporter) {
      try {
        const info = await this.smtpTransporter.sendMail({
          from: `"${this.brevoFromName}" <${this.brevoFromEmail}>`,
          to,
          subject,
          html,
        });
        this.logger.log(
          `Email sent via SMTP to ${to} (MessageId: ${info.messageId})`,
        );
        return { success: true, messageId: info.messageId };
      } catch (err) {
        this.logger.error(
          `Failed to send SMTP email to ${to}: ${(err as Error).message}`,
        );
        return { success: false, error: (err as Error).message };
      }
    }

    // ── Brevo REST API path ────────────────────────────────────────────────
    if (this.brevoApiKey) {
      try {
        const body = JSON.stringify({
          sender: { name: this.brevoFromName, email: this.brevoFromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        });

        const result = await new Promise<{ messageId?: string }>(
          (resolve, reject) => {
            const req = https.request(
              {
                hostname: 'api.brevo.com',
                path: '/v3/smtp/email',
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api-key': this.brevoApiKey!,
                  Accept: 'application/json',
                  'Content-Length': Buffer.byteLength(body),
                },
              },
              (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                  if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                      resolve(JSON.parse(data));
                    } catch {
                      resolve({});
                    }
                  } else {
                    reject(
                      new Error(
                        `Brevo API returned ${res.statusCode}: ${data}`,
                      ),
                    );
                  }
                });
              },
            );
            req.on('error', reject);
            req.write(body);
            req.end();
          },
        );

        this.logger.log(
          `Email sent via Brevo to ${to} (MessageId: ${result.messageId ?? 'n/a'})`,
        );
        return { success: true, messageId: result.messageId };
      } catch (err) {
        this.logger.error(
          `Failed to send Brevo email to ${to}: ${(err as Error).message}`,
        );
        return { success: false, error: (err as Error).message };
      }
    }

    // ── Dev fallback (no transport configured) ─────────────────────────────
    this.logger.log(`[mail:dev] To: ${to} | Subject: ${subject}`);
    return { success: false, skipped: true };
  }
}
