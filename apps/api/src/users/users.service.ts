import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        tokenBalance: {
          select: {
            balance: true,
          },
        },
      },
    });

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        profile: {
          select: {
            displayName: true,
          },
        },
      },
    });

    const displayName =
      dto.displayName?.trim() || user.profile?.displayName || user.email.split('@')[0] || user.email;

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName,
        phone: dto.phone,
        location: dto.location,
        bio: dto.bio,
        avatarUrl: dto.avatarKey ?? dto.avatarUrl,
        companyName: dto.companyName,
        tradeCategories: dto.tradeCategories ?? [],
      },
      update: {
        displayName,
        phone: dto.phone,
        location: dto.location,
        bio: dto.bio,
        avatarUrl: dto.avatarKey ?? dto.avatarUrl,
        companyName: dto.companyName,
        tradeCategories: dto.tradeCategories,
      },
    });

    return profile;
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        profile: {
          select: {
            displayName: true,
          },
        },
      },
    });

    const displayName = user.profile?.displayName || user.email.split('@')[0] || user.email;

    return this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName,
        avatarUrl,
        tradeCategories: [],
      },
      update: {
        avatarUrl,
      },
    });
  }

  async deactivateAccount(userId: string) {
    await this.prisma.$transaction([
      this.prisma.pushToken.updateMany({
        where: { userId },
        data: { isActive: false },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.SUSPENDED,
          refreshTokenHash: null,
        },
      }),
    ]);

    return {
      success: true,
      status: UserStatus.SUSPENDED,
      message: 'Account deactivated. Existing marketplace records are retained for audit and transaction history.',
    };
  }
}
