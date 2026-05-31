import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type TokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds());
    const displayName = dto.displayName?.trim() || dto.email.split('@')[0] || dto.email;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        profile: {
          create: {
            displayName,
            phone: dto.phone,
            location: dto.location,
            avatarUrl: dto.avatarUrl,
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

    return this.issueAndPersistTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

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

  private async issueAndPersistTokens(user: {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    profile?: unknown;
  }) {
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

  private toAuthUser(user: {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    profile?: unknown;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      profile: user.profile,
    };
  }

  private bcryptRounds() {
    const configuredRounds = this.config.get<string>('BCRYPT_ROUNDS');
    const parsedRounds = Number(configuredRounds);
    return Number.isInteger(parsedRounds) && parsedRounds >= 10 ? parsedRounds : 12;
  }
}
