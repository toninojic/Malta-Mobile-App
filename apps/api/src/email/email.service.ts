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
        primaryLabel: 'Verify Email',
        primaryUrl: links.webUrl,
        fallbackUrl: links.webUrl,
        appDeepLink: links.deepLink,
      }),
      text: `Verify your MaltaPro email: ${links.webUrl}\nIf the button does not work, copy and paste this link: ${links.webUrl}\nOpen in MaltaPro app: ${links.deepLink}`,
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
        primaryLabel: 'Reset Password',
        primaryUrl: links.webUrl,
        fallbackUrl: links.webUrl,
        appDeepLink: links.deepLink,
      }),
      text: `Reset your MaltaPro password: ${links.webUrl}\nIf the button does not work, copy and paste this link: ${links.webUrl}\nOpen in MaltaPro app: ${links.deepLink}`,
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
    const webBaseUrl = this.authWebBaseUrl();
    const encodedToken = encodeURIComponent(token);
    const deepLink = `${scheme}://${path}?token=${encodedToken}`;

    if (!webBaseUrl) {
      this.logger.error(
        `AUTH_WEB_FALLBACK_URL or APP_BASE_URL is not configured. Falling back to app deep link for ${path} email.`,
      );
    }

    return {
      deepLink,
      webUrl: webBaseUrl ? `${webBaseUrl}/${path}?token=${encodedToken}` : deepLink,
    };
  }

  private authWebBaseUrl() {
    const explicitFallback = this.config.get<string>('AUTH_WEB_FALLBACK_URL')?.trim();
    if (explicitFallback) {
      return explicitFallback.replace(/\/$/, '');
    }

    const appBaseUrl = this.config.get<string>('APP_BASE_URL')?.trim();
    if (appBaseUrl) {
      return this.withAuthPath(appBaseUrl);
    }

    const publicUrl = this.config.get<string>('APP_PUBLIC_URL')?.trim();
    return publicUrl ? publicUrl.replace(/\/$/, '') : null;
  }

  private withAuthPath(value: string) {
    const normalized = value.replace(/\/+$/, '');
    if (/\/api\/v\d+\/auth$/i.test(normalized)) {
      return normalized;
    }
    if (/\/api\/v\d+$/i.test(normalized)) {
      return `${normalized}/auth`;
    }
    return `${normalized}/api/v1/auth`;
  }

  private authEmailHtml(input: {
    title: string;
    greeting: string;
    body: string;
    primaryLabel?: string;
    primaryUrl?: string;
    fallbackUrl?: string;
    appDeepLink?: string;
  }) {
    const action = input.primaryLabel && input.primaryUrl
      ? `<p><a href="${escapeHtml(input.primaryUrl)}" style="display:inline-block;background:#16A34A;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(input.primaryLabel)}</a></p>`
      : '';
    const fallback = input.fallbackUrl
      ? `<p style="color:#64748b;font-size:13px">If the button does not work, copy and paste this link:<br><a href="${escapeHtml(input.fallbackUrl)}" style="color:#16A34A">${escapeHtml(input.fallbackUrl)}</a></p>`
      : '';
    const appDeepLink = input.appDeepLink
      ? `<p style="color:#64748b;font-size:13px">If MaltaPro is installed, this app link can also open it:<br>${escapeHtml(input.appDeepLink)}</p>`
      : '';

    return `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h1>${escapeHtml(input.title)}</h1>
        <p>${escapeHtml(input.greeting)}</p>
        <p>${escapeHtml(input.body)}</p>
        ${action}
        ${fallback}
        ${appDeepLink}
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
