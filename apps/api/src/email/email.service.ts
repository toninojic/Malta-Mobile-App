import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(input: { to: string; token: string; displayName?: string | null }) {
    const links = this.authLinks('verify-email', input.token);
    return this.send({
      to: input.to,
      subject: 'Verify your MaltaPro email',
      html: this.authEmailHtml({
        title: 'Verify your email',
        greeting: `Hi ${input.displayName ?? 'there'},`,
        body: 'Confirm your email address so your MaltaPro account is ready for production notifications and account recovery.',
        primaryLabel: 'Verify email',
        primaryUrl: links.deepLink,
        fallbackUrl: links.webUrl,
      }),
      text: `Verify your MaltaPro email: ${links.deepLink}\nFallback: ${links.webUrl}`,
    });
  }

  async sendPasswordResetEmail(input: { to: string; token: string; displayName?: string | null }) {
    const links = this.authLinks('reset-password', input.token);
    return this.send({
      to: input.to,
      subject: 'Reset your MaltaPro password',
      html: this.authEmailHtml({
        title: 'Reset your password',
        greeting: `Hi ${input.displayName ?? 'there'},`,
        body: 'Use this secure link to choose a new password. The link expires soon and can be used once.',
        primaryLabel: 'Reset password',
        primaryUrl: links.deepLink,
        fallbackUrl: links.webUrl,
      }),
      text: `Reset your MaltaPro password: ${links.deepLink}\nFallback: ${links.webUrl}`,
    });
  }

  async sendGoogleOnlyPasswordNotice(input: { to: string; displayName?: string | null }) {
    return this.send({
      to: input.to,
      subject: 'Use Google Sign-In for MaltaPro',
      html: this.authEmailHtml({
        title: 'Use Google Sign-In',
        greeting: `Hi ${input.displayName ?? 'there'},`,
        body: 'This MaltaPro account uses Google Sign-In. Open the app and choose Continue with Google.',
      }),
      text: 'This MaltaPro account uses Google Sign-In. Open the app and choose Continue with Google.',
    });
  }

  private async send(payload: EmailPayload) {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const from = this.config.get<string>('RESEND_FROM_EMAIL')?.trim() || 'MaltaPro <onboarding@resend.dev>';
    const deliveryDisabled = ['true', '1', 'yes', 'on'].includes(
      String(this.config.get<string>('AUTH_EMAIL_DELIVERY_DISABLED') ?? '').trim().toLowerCase(),
    );

    if (deliveryDisabled) {
      this.logger.warn(`AUTH_EMAIL_DELIVERY_DISABLED is enabled. Skipping email to ${payload.to}: ${payload.subject}`);
      return { skipped: true };
    }

    if (!apiKey) {
      this.logger.warn(`RESEND_API_KEY is not configured. Skipping email to ${payload.to}: ${payload.subject}`);
      return { skipped: true };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Resend email failed status=${response.status} body=${body.slice(0, 500)}`);
      throw new Error('Could not send email.');
    }

    return { skipped: false };
  }

  private authLinks(path: 'verify-email' | 'reset-password', token: string) {
    const scheme = this.config.get<string>('MOBILE_DEEP_LINK_SCHEME')?.trim() || 'maltapro';
    const publicUrl = this.config.get<string>('APP_PUBLIC_URL')?.trim() || this.config.get<string>('APP_BASE_URL')?.trim();
    const encodedToken = encodeURIComponent(token);

    return {
      deepLink: `${scheme}://${path}?token=${encodedToken}`,
      webUrl: publicUrl ? `${publicUrl.replace(/\/$/, '')}/${path}?token=${encodedToken}` : `${scheme}://${path}?token=${encodedToken}`,
    };
  }

  private authEmailHtml(input: {
    title: string;
    greeting: string;
    body: string;
    primaryLabel?: string;
    primaryUrl?: string;
    fallbackUrl?: string;
  }) {
    const action = input.primaryLabel && input.primaryUrl
      ? `<p><a href="${escapeHtml(input.primaryUrl)}" style="display:inline-block;background:#16A34A;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(input.primaryLabel)}</a></p>`
      : '';
    const fallback = input.fallbackUrl
      ? `<p style="color:#64748b;font-size:13px">If the button does not open, copy this link:<br>${escapeHtml(input.fallbackUrl)}</p>`
      : '';

    return `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h1>${escapeHtml(input.title)}</h1>
        <p>${escapeHtml(input.greeting)}</p>
        <p>${escapeHtml(input.body)}</p>
        ${action}
        ${fallback}
        <p style="color:#64748b;font-size:13px">MaltaPro</p>
      </div>
    `;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
