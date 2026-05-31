import { Injectable } from '@nestjs/common';
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
        avatarUrl: dto.avatarUrl,
        companyName: dto.companyName,
        tradeCategories: dto.tradeCategories ?? [],
      },
      update: {
        displayName,
        phone: dto.phone,
        location: dto.location,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
        companyName: dto.companyName,
        tradeCategories: dto.tradeCategories,
      },
    });

    return profile;
  }
}
