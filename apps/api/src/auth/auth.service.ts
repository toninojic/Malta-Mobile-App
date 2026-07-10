import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotificationType, Prisma, UserAuthProvider, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { EmailService } from '../email/email.service';
import { normalizePhoneNumber } from '../common/phone';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

type TokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

type AuthUserRecord = {
  id: string;
  email: string;
  passwordHash?: string | null;
  authProvider: UserAuthProvider;
  googleId?: string | null;
  emailVerifiedAt?: Date | null;
  termsAcceptedAt?: Date | null;
  privacyAcceptedAt?: Date | null;
  role: UserRole;
  status: UserStatus;
  profile?: unknown;
};

type GoogleIdentity = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  displayName?: string | null;
  picture?: string | null;
  audience?: string | null;
};

type GoogleAuthUserRecord = Prisma.UserGetPayload<{ include: { profile: true } }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    this.assertLegalConsent(dto.termsAccepted, dto.privacyAccepted);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });

    if (existingUser) {
      if (existingUser.status === UserStatus.SUSPENDED && existingUser.deactivatedAt) {
        if (existingUser.role !== dto.role) {
          throw new BadRequestException(this.reactivationRoleMessage(existingUser.role));
        }

        return this.reactivateEmailAccount(existingUser, dto);
      }

      throw new ConflictException('Email is already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds());
    const displayName = dto.displayName?.trim() || dto.email.split('@')[0] || dto.email;
    const verificationToken = this.createSecureToken();
    const consentAcceptedAt = new Date();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        authProvider: UserAuthProvider.EMAIL,
        emailVerificationTokenHash: this.hashToken(verificationToken),
        emailVerificationExpiresAt: this.expiresInHours(24),
        termsAcceptedAt: consentAcceptedAt,
        privacyAcceptedAt: consentAcceptedAt,
        role: dto.role,
        contractorOnboardingRequiredAt: dto.role === UserRole.CONTRACTOR ? new Date() : undefined,
        profile: {
          create: {
            displayName,
            phone: normalizePhoneNumber(dto.phone),
            location: dto.location,
            avatarUrl: dto.avatarKey ?? dto.avatarUrl,
            companyName: dto.companyName,
            tradeCategories: dto.tradeCategories ?? [],
          },
        },
        tokenBalance: {
          create: {
            balance: 0,
          },
        },
      },
      include: { profile: true },
    });

    await this.emailService.sendVerificationEmail({
      to: user.email,
      token: verificationToken,
      displayName,
    });

    return {
      ...(await this.issueAndPersistTokens(user)),
      verificationEmailSent: true,
      ...(this.shouldExposeDebugTokens() ? { debugEmailVerificationToken: verificationToken } : {}),
    };
  }

  async login(dto: LoginDto) {
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      if (!user.deactivatedAt || user.role === UserRole.ADMIN) {
        throw new UnauthorizedException('Invalid credentials.');
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.ACTIVE,
          deactivatedAt: null,
        },
        include: { profile: true },
      });
    }

    return this.issueAndPersistTokens(user);
  }

  async google(dto: GoogleAuthDto) {
    const identity = await this.verifyGoogleIdentity(dto.idToken);
    let user = await this.findGoogleAuthUser(identity);

    if (user) {
      if (user.status !== UserStatus.ACTIVE) {
        return this.reactivateGoogleAccount(user, identity, dto);
      }

      const nextProvider =
        user.authProvider === UserAuthProvider.EMAIL ? UserAuthProvider.BOTH : user.authProvider;

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId ?? identity.googleId,
          authProvider: nextProvider,
          emailVerifiedAt: user.emailVerifiedAt ?? (identity.emailVerified ? new Date() : null),
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
          profile: identity.displayName || identity.picture
            ? {
                update: {
                  displayName: identity.displayName || undefined,
                  avatarUrl: identity.picture || undefined,
                },
              }
            : undefined,
        },
        include: { profile: true },
      });

      return this.issueAndPersistTokens(user);
    }

    if (!dto.role) {
      throw new BadRequestException('Role is required for first-time Google sign-up.');
    }
    this.assertLegalConsent(dto.termsAccepted, dto.privacyAccepted);
    const consentAcceptedAt = new Date();

    user = await this.prisma.user.upsert({
      where: { email: identity.email },
      update: {},
      create: {
        email: identity.email,
        passwordHash: null,
        authProvider: UserAuthProvider.GOOGLE,
        googleId: identity.googleId,
        emailVerifiedAt: identity.emailVerified ? new Date() : null,
        termsAcceptedAt: consentAcceptedAt,
        privacyAcceptedAt: consentAcceptedAt,
        role: dto.role,
        contractorOnboardingRequiredAt: dto.role === UserRole.CONTRACTOR ? new Date() : undefined,
        profile: {
          create: {
            displayName: identity.displayName || identity.email.split('@')[0] || identity.email,
            avatarUrl: identity.picture,
            tradeCategories: [],
          },
        },
        tokenBalance: { create: { balance: 0 } },
      },
      include: { profile: true },
    });

    if (user.status !== UserStatus.ACTIVE) {
      return this.reactivateGoogleAccount(user, identity, dto);
    }

    return this.issueAndPersistTokens(user);
  }

  private async findGoogleAuthUser(identity: GoogleIdentity): Promise<GoogleAuthUserRecord | null> {
    const [userByGoogleId, userByEmail] = await Promise.all([
      this.prisma.user.findUnique({
        where: { googleId: identity.googleId },
        include: { profile: true },
      }),
      this.prisma.user.findUnique({
        where: { email: identity.email },
        include: { profile: true },
      }),
    ]);

    if (userByGoogleId && userByEmail && userByGoogleId.id !== userByEmail.id) {
      throw new ConflictException('This Google account conflicts with another MaltaPro account. Contact support.');
    }

    if (userByEmail?.googleId && userByEmail.googleId !== identity.googleId) {
      throw new ConflictException('This email is already linked to another Google account. Contact support.');
    }

    return userByGoogleId ?? userByEmail;
  }

  private async reactivateEmailAccount(user: GoogleAuthUserRecord, dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds());
    const verificationToken = this.createSecureToken();
    const consentAcceptedAt = new Date();
    const displayName = dto.displayName?.trim() || user.profile?.displayName || dto.email.split('@')[0] || dto.email;
    const authProvider =
      user.authProvider === UserAuthProvider.GOOGLE ? UserAuthProvider.BOTH : user.authProvider;

    const reactivated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        authProvider,
        status: UserStatus.ACTIVE,
        deactivatedAt: null,
        emailVerifiedAt: null,
        emailVerificationTokenHash: this.hashToken(verificationToken),
        emailVerificationExpiresAt: this.expiresInHours(24),
        termsAcceptedAt: consentAcceptedAt,
        privacyAcceptedAt: consentAcceptedAt,
        profile: {
          upsert: {
            create: {
              displayName,
              phone: normalizePhoneNumber(dto.phone),
              location: dto.location,
              avatarUrl: dto.avatarKey ?? dto.avatarUrl,
              companyName: dto.companyName,
              tradeCategories: dto.tradeCategories ?? [],
            },
            update: {
              displayName,
              phone: normalizePhoneNumber(dto.phone),
              location: dto.location,
              avatarUrl: dto.avatarKey ?? dto.avatarUrl,
              companyName: dto.companyName,
              tradeCategories: dto.tradeCategories ?? [],
            },
          },
        },
      },
      include: { profile: true },
    });

    await this.emailService.sendVerificationEmail({
      to: reactivated.email,
      token: verificationToken,
      displayName,
    });

    return {
      ...(await this.issueAndPersistTokens(reactivated)),
      verificationEmailSent: true,
      accountReactivated: true,
      ...(this.shouldExposeDebugTokens() ? { debugEmailVerificationToken: verificationToken } : {}),
    };
  }

  private async reactivateGoogleAccount(
    user: GoogleAuthUserRecord,
    identity: GoogleIdentity,
    dto: GoogleAuthDto,
  ) {
    if (user.role === UserRole.ADMIN) {
      throw new UnauthorizedException('User is not active.');
    }

    const canReactivate =
      Boolean(user.deactivatedAt) || (await this.isLegacyGoogleSelfDeactivation(user.id));

    if (!canReactivate) {
      throw new UnauthorizedException('User is not active.');
    }

    if (dto.role && dto.role !== user.role) {
      throw new BadRequestException(this.reactivationRoleMessage(user.role));
    }

    if (dto.role) {
      this.assertLegalConsent(dto.termsAccepted, dto.privacyAccepted);
    }

    const consentAcceptedAt = dto.role ? new Date() : undefined;
    const nextProvider =
      user.authProvider === UserAuthProvider.EMAIL ? UserAuthProvider.BOTH : user.authProvider;
    const displayName = identity.displayName || user.profile?.displayName || identity.email.split('@')[0] || identity.email;

    const reactivated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        deactivatedAt: null,
        googleId: user.googleId ?? identity.googleId,
        authProvider: nextProvider,
        emailVerifiedAt: user.emailVerifiedAt ?? (identity.emailVerified ? new Date() : null),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        termsAcceptedAt: consentAcceptedAt,
        privacyAcceptedAt: consentAcceptedAt,
        profile: {
          upsert: {
            create: {
              displayName,
              avatarUrl: identity.picture,
              tradeCategories: [],
            },
            update: {
              displayName,
              avatarUrl: identity.picture || undefined,
            },
          },
        },
      },
      include: { profile: true },
    });

    return {
      ...(await this.issueAndPersistTokens(reactivated)),
      accountReactivated: true,
    };
  }

  private async isLegacyGoogleSelfDeactivation(userId: string) {
    const [moderationAudit, suspensionNotification] = await Promise.all([
      this.prisma.auditLog.findFirst({
        where: {
          entityType: 'User',
          entityId: userId,
          action: { in: ['USER_SUSPENDED', 'USER_SUSPENDED_FROM_REPORT'] },
        },
        select: { id: true },
      }),
      this.prisma.notification.findFirst({
        where: {
          userId,
          type: NotificationType.ACCOUNT_SUSPENDED,
        },
        select: { id: true },
      }),
    ]);

    return !moderationAudit && !suspensionNotification;
  }

  private reactivationRoleMessage(role: UserRole) {
    if (role === UserRole.ADMIN) {
      return 'Admin accounts can only be reactivated by another admin.';
    }

    const roleLabel = role === UserRole.CONTRACTOR ? 'Contractor' : 'Employer';
    return `This account was previously registered as ${roleLabel}. Select ${roleLabel} to reactivate it.`;
  }

  async refresh(refreshToken: string) {
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    return this.issueAndPersistTokens(user);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });

    return this.toAuthUser(user);
  }

  async sendEmailVerification(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active.');
    }

    if (user.emailVerifiedAt) {
      return { success: true, alreadyVerified: true };
    }

    const token = this.createSecureToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: this.hashToken(token),
        emailVerificationExpiresAt: this.expiresInHours(24),
      },
    });

    await this.emailService.sendVerificationEmail({
      to: user.email,
      token,
      displayName: user.profile?.displayName,
    });

    return {
      success: true,
      alreadyVerified: false,
      ...(this.shouldExposeDebugTokens() ? { debugEmailVerificationToken: token } : {}),
    };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: this.hashToken(token),
        emailVerificationExpiresAt: { gt: new Date() },
      },
      include: { profile: true },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token.');
    }

    if (user.emailVerifiedAt) {
      return { success: true, alreadyVerified: true, user: this.toAuthUser(user) };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
      include: { profile: true },
    });

    return { success: true, alreadyVerified: false, user: this.toAuthUser(updated) };
  }

  emailVerificationHtml(input: { title: string; body: string; success: boolean }) {
    const appLink = `${this.config.get<string>('MOBILE_DEEP_LINK_SCHEME')?.trim() || 'maltapro'}://`;
    const color = input.success ? '#16A34A' : '#ED3A35';

    return `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(input.title)} - MaltaPro</title>
        </head>
        <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
          <main style="max-width:560px;margin:48px auto;padding:24px">
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
              <div style="width:44px;height:44px;border-radius:999px;background:${color};margin-bottom:18px"></div>
              <h1 style="margin:0 0 12px;font-size:28px">${escapeHtml(input.title)}</h1>
              <p style="font-size:16px;line-height:1.5;color:#475569">${escapeHtml(input.body)}</p>
              <p>
                <a href="${escapeHtml(appLink)}" style="display:inline-block;background:#16A34A;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
                  Open MaltaPro
                </a>
              </p>
            </div>
          </main>
        </body>
      </html>`;
  }

  passwordResetHtml(token?: string) {
    const scheme = this.config.get<string>('MOBILE_DEEP_LINK_SCHEME')?.trim() || 'maltapro';
    const appLink = token ? `${scheme}://reset-password?token=${encodeURIComponent(token)}` : `${scheme}://`;
    const form = token
      ? `<form id="reset-form" style="display:grid;gap:12px;margin-top:20px">
          <label style="display:grid;gap:6px;font-size:14px;font-weight:700;color:#334155">
            New password
            <input id="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password" style="border:1px solid #cbd5e1;border-radius:8px;font-size:16px;padding:12px" />
          </label>
          <label style="display:grid;gap:6px;font-size:14px;font-weight:700;color:#334155">
            Confirm password
            <input id="confirm-password" type="password" minlength="8" maxlength="128" required autocomplete="new-password" style="border:1px solid #cbd5e1;border-radius:8px;font-size:16px;padding:12px" />
          </label>
          <button id="submit-button" type="submit" style="background:#16A34A;border:0;border-radius:8px;color:#fff;font-size:15px;font-weight:700;padding:13px 18px">
            Reset Password
          </button>
        </form>`
      : '';
    const script = token
      ? `<script>
          const form = document.getElementById('reset-form');
          const status = document.getElementById('status');
          const submitButton = document.getElementById('submit-button');
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            if (password !== confirmPassword) {
              status.textContent = 'Passwords do not match.';
              status.style.color = '#dc2626';
              return;
            }
            submitButton.disabled = true;
            submitButton.textContent = 'Resetting...';
            status.textContent = 'Resetting your password...';
            status.style.color = '#475569';
            try {
              const response = await fetch(window.location.pathname, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: ${jsonForHtmlScript(token)}, newPassword: password }),
              });
              const body = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(body.message || 'This reset link is invalid or expired.');
              }
              form.style.display = 'none';
              status.textContent = 'Your password has been reset.';
              status.style.color = '#16A34A';
              document.getElementById('open-app').style.display = 'inline-block';
            } catch (error) {
              status.textContent = error instanceof Error ? error.message : 'This reset link is invalid or expired.';
              status.style.color = '#dc2626';
              submitButton.disabled = false;
              submitButton.textContent = 'Reset Password';
            }
          });
        </script>`
      : '';
    const title = token ? 'Reset your password' : 'Reset link missing';
    const body = token
      ? 'Choose a new password for your MaltaPro account.'
      : 'This password reset link is missing a token. Open MaltaPro and request a new reset email.';

    return `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(title)} - MaltaPro</title>
        </head>
        <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
          <main style="max-width:560px;margin:48px auto;padding:24px">
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
              <div style="width:44px;height:44px;border-radius:999px;background:#16A34A;margin-bottom:18px"></div>
              <h1 style="margin:0 0 12px;font-size:28px">${escapeHtml(title)}</h1>
              <p style="font-size:16px;line-height:1.5;color:#475569">${escapeHtml(body)}</p>
              <p id="status" style="font-size:15px;line-height:1.5;color:#475569"></p>
              ${form}
              <p>
                <a id="open-app" href="${escapeHtml(appLink)}" style="display:${token ? 'none' : 'inline-block'};background:#16A34A;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
                  Open MaltaPro
                </a>
              </p>
              <p style="font-size:13px;line-height:1.5;color:#64748b;word-break:break-all">
                App link: ${escapeHtml(appLink)}
              </p>
            </div>
          </main>
          ${script}
        </body>
      </html>`;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const generic = { success: true, message: 'If an account exists, password reset instructions were sent.' };
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return generic;
    }

    if (!user.passwordHash) {
      await this.emailService.sendGoogleOnlyPasswordNotice({
        to: user.email,
        displayName: user.profile?.displayName,
      });
      return generic;
    }

    const token = this.createSecureToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: this.hashToken(token),
        passwordResetExpiresAt: this.expiresInHours(1),
        passwordResetUsedAt: null,
      },
    });

    await this.emailService.sendPasswordResetEmail({
      to: user.email,
      token,
      displayName: user.profile?.displayName,
    });

    return {
      ...generic,
      ...(this.shouldExposeDebugTokens() ? { debugPasswordResetToken: token } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: this.hashToken(dto.token),
        passwordResetExpiresAt: { gt: new Date() },
        passwordResetUsedAt: null,
      },
      include: { profile: true },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds());
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        authProvider: user.authProvider === UserAuthProvider.GOOGLE ? UserAuthProvider.BOTH : user.authProvider,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetUsedAt: new Date(),
        refreshTokenHash: null,
      },
      include: { profile: true },
    });

    return { success: true, user: this.toAuthUser(updated) };
  }

  private async issueAndPersistTokens(user: AuthUserRecord) {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('ACCESS_TOKEN_TTL') ?? '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('REFRESH_TOKEN_TTL') ?? '30d',
      }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, this.bcryptRounds());
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user),
    };
  }

  private toAuthUser(user: AuthUserRecord) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      authProvider: user.authProvider,
      emailVerifiedAt: user.emailVerifiedAt,
      termsAcceptedAt: user.termsAcceptedAt,
      privacyAcceptedAt: user.privacyAcceptedAt,
      profile: user.profile,
    };
  }

  private assertLegalConsent(termsAccepted: boolean | undefined, privacyAccepted: boolean | undefined) {
    if (!termsAccepted || !privacyAccepted) {
      throw new BadRequestException('You must accept the Terms of Use and Privacy Policy to continue.');
    }
  }

  private async verifyGoogleIdentity(idToken: string): Promise<GoogleIdentity> {
    if (this.canUseMockGoogleToken(idToken)) {
      return this.parseMockGoogleToken(idToken);
    }

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google token.');
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const audience = typeof payload.aud === 'string' ? payload.aud : null;
    this.assertAllowedGoogleAudience(audience);

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const googleId = typeof payload.sub === 'string' ? payload.sub : '';
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!email || !googleId || !emailVerified) {
      throw new UnauthorizedException('Google account email must be verified.');
    }

    return {
      googleId,
      email,
      emailVerified,
      audience,
      displayName: typeof payload.name === 'string' ? payload.name : null,
      picture: typeof payload.picture === 'string' ? payload.picture : null,
    };
  }

  private assertAllowedGoogleAudience(audience: string | null) {
    const allowed = [
      this.config.get<string>('GOOGLE_ANDROID_CLIENT_ID'),
      this.config.get<string>('GOOGLE_IOS_CLIENT_ID'),
      this.config.get<string>('GOOGLE_WEB_CLIENT_ID'),
      ...(this.config.get<string>('GOOGLE_ALLOWED_CLIENT_IDS')?.split(',') ?? []),
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    if (allowed.length && (!audience || !allowed.includes(audience))) {
      throw new UnauthorizedException('Google token audience is not allowed.');
    }
  }

  private canUseMockGoogleToken(idToken: string) {
    return (
      idToken.startsWith('mock-google:') &&
      (this.config.get<string>('NODE_ENV') !== 'production' ||
        ['true', '1', 'yes'].includes(String(this.config.get<string>('AUTH_ALLOW_MOCK_GOOGLE')).toLowerCase()))
    );
  }

  private parseMockGoogleToken(idToken: string): GoogleIdentity {
    try {
      const json = Buffer.from(idToken.replace('mock-google:', ''), 'base64url').toString('utf8');
      const payload = JSON.parse(json) as Partial<GoogleIdentity>;
      if (!payload.googleId || !payload.email) {
        throw new Error('Missing mock Google fields.');
      }
      return {
        googleId: payload.googleId,
        email: payload.email.trim().toLowerCase(),
        emailVerified: payload.emailVerified !== false,
        audience: payload.audience ?? 'mock',
        displayName: payload.displayName ?? null,
        picture: payload.picture ?? null,
      };
    } catch {
      throw new UnauthorizedException('Invalid mock Google token.');
    }
  }

  private createSecureToken() {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiresInHours(hours: number) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private shouldExposeDebugTokens() {
    return (
      this.config.get<string>('NODE_ENV') !== 'production' &&
      String(this.config.get<string>('AUTH_EMAIL_DEBUG_TOKENS') ?? 'true').toLowerCase() !== 'false'
    );
  }

  private bcryptRounds() {
    const configuredRounds = this.config.get<string>('BCRYPT_ROUNDS');
    const parsedRounds = Number(configuredRounds);
    return Number.isInteger(parsedRounds) && parsedRounds >= 10 ? parsedRounds : 12;
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

function jsonForHtmlScript(value: string) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}
