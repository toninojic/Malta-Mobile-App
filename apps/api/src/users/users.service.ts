import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { normalizePhoneNumber } from '../common/phone';
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
    const phone = dto.phone === undefined ? undefined : normalizePhoneNumber(dto.phone) ?? null;

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName,
        phone,
        location: dto.location,
        bio: dto.bio,
        avatarUrl: dto.avatarKey ?? dto.avatarUrl,
        companyName: dto.companyName,
        tradeCategories: dto.tradeCategories ?? [],
      },
      update: {
        displayName,
        phone,
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
          deactivatedAt: new Date(),
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

  async findBlockedUsers(userId: string) {
    const blocks = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      select: {
        id: true,
        blockedId: true,
        createdAt: true,
        blocked: {
          select: {
            id: true,
            role: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((block) => ({
      id: block.id,
      blockedUserId: block.blockedId,
      createdAt: block.createdAt,
      user: block.blocked,
    }));
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundException('User not found.');
    }

    const block = await this.prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
      create: { blockerId, blockedId },
      update: {},
      select: {
        id: true,
        blockedId: true,
        createdAt: true,
      },
    });

    return {
      ...block,
      blockedUserId: block.blockedId,
      isBlocked: true,
    };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({
      where: { blockerId, blockedId },
    });

    return {
      blockedUserId: blockedId,
      isBlocked: false,
    };
  }
}
