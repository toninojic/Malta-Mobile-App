import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ContractorServiceCategory, ContractorServiceLocation, Prisma, UserRole } from '@prisma/client';
import { assertValidServiceCategory } from '../common/service-categories';
import {
  isKnownServiceLocation,
  MALTA_SERVICE_LOCATIONS,
  normalizeLocationKey,
  serviceLocationLabel,
} from '../common/malta-locations';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateServiceAreasDto } from './dto/update-service-areas.dto';
import { UpdateServiceCategoriesDto } from './dto/update-service-categories.dto';

@Injectable()
export class ContractorsService {
  constructor(private readonly prisma: PrismaService) {}

  async serviceAreas(user: AuthenticatedUser) {
    this.assertContractor(user);

    const locations = await this.prisma.contractorServiceLocation.findMany({
      where: { contractorId: user.id },
      orderBy: { locationLabel: 'asc' },
    });

    return {
      availableLocations: MALTA_SERVICE_LOCATIONS,
      locations: locations.map((location) => this.toServiceLocation(location)),
    };
  }

  async updateServiceAreas(user: AuthenticatedUser, dto: UpdateServiceAreasDto) {
    this.assertContractor(user);

    const uniqueLocations = [...new Set(dto.locations.map((location) => normalizeLocationKey(location)).filter(Boolean))];
    uniqueLocations.forEach((locationKey) => {
      if (!isKnownServiceLocation(locationKey)) {
        throw new BadRequestException(`Unsupported service location: ${locationKey}`);
      }
    });

    const locations = await this.prisma.$transaction(async (tx) => {
      await tx.contractorServiceLocation.deleteMany({
        where: { contractorId: user.id },
      });

      if (uniqueLocations.length) {
        await tx.contractorServiceLocation.createMany({
          data: uniqueLocations.map((locationKey) => ({
            contractorId: user.id,
            locationKey,
            locationLabel: serviceLocationLabel(locationKey),
          })),
        });
      }

      return tx.contractorServiceLocation.findMany({
        where: { contractorId: user.id },
        orderBy: { locationLabel: 'asc' },
      });
    });

    return {
      availableLocations: MALTA_SERVICE_LOCATIONS,
      locations: locations.map((location) => this.toServiceLocation(location)),
    };
  }

  async serviceCategories(user: AuthenticatedUser) {
    this.assertContractor(user);

    const categories = await this.prisma.contractorServiceCategory.findMany({
      where: { contractorId: user.id },
      orderBy: [{ categoryKey: 'asc' }, { subcategoryKey: 'asc' }],
    });

    return { categories: categories.map((category) => this.toServiceCategory(category)) };
  }

  async updateServiceCategories(user: AuthenticatedUser, dto: UpdateServiceCategoriesDto) {
    this.assertContractor(user);

    const unique = new Map<string, { categoryKey: string; subcategoryKey: string | null }>();
    dto.categories.forEach((category) => {
      const categoryKey = category.categoryKey.trim();
      const subcategoryKey = category.subcategoryKey?.trim() || null;
      assertValidServiceCategory(categoryKey, subcategoryKey ?? undefined);
      unique.set(`${categoryKey}:${subcategoryKey ?? ''}`, { categoryKey, subcategoryKey });
    });

    const categories = await this.prisma.$transaction(async (tx) => {
      await tx.contractorServiceCategory.deleteMany({
        where: { contractorId: user.id },
      });

      if (unique.size) {
        await tx.contractorServiceCategory.createMany({
          data: [...unique.values()].map((category) => ({
            contractorId: user.id,
            categoryKey: category.categoryKey,
            subcategoryKey: category.subcategoryKey,
          })),
        });
      }

      return tx.contractorServiceCategory.findMany({
        where: { contractorId: user.id },
        orderBy: [{ categoryKey: 'asc' }, { subcategoryKey: 'asc' }],
      });
    });

    return { categories: categories.map((category) => this.toServiceCategory(category)) };
  }

  private assertContractor(user: AuthenticatedUser) {
    if (user.role !== UserRole.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can manage service preferences.');
    }
  }

  private toServiceLocation(location: ContractorServiceLocation) {
    return {
      id: location.id,
      contractorId: location.contractorId,
      locationKey: location.locationKey,
      locationLabel: location.locationLabel,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    };
  }

  private toServiceCategory(category: ContractorServiceCategory) {
    return {
      id: category.id,
      contractorId: category.contractorId,
      categoryKey: category.categoryKey,
      subcategoryKey: category.subcategoryKey,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
