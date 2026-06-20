import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserAuthProvider, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { EmailService } from '../email/email.service';
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
      select: { id: true },
    });

    if (existingUser) {
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
            phone: dto.phone,
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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.issueAndPersistTokens(user);
  }

  async google(dto: GoogleAuthDto) {
    const identity = await this.verifyGoogleIdentity(dto.idToken);
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: identity.googleId }, { email: identity.email }],
      },
      include: { profile: true },
    });

    if (user) {
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('User is not active.');
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

    user = await this.prisma.user.create({
      data: {
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

    return this.issueAndPersistTokens(user);
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
