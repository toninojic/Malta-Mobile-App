import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
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

type ServiceCategorySelection = {
  categoryKey: string;
  subcategoryKey: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

@Injectable()
export class ContractorsService {
  private readonly logger = new Logger(ContractorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async serviceAreas(user: AuthenticatedUser) {
    this.assertContractor(user);

    try {
      const locations = await this.prisma.contractorServiceLocation.findMany({
        where: { contractorId: user.id },
        orderBy: { locationLabel: 'asc' },
      });

      this.logDev('service locations loaded', { contractorId: user.id, count: locations.length });

      return {
        availableLocations: MALTA_SERVICE_LOCATIONS,
        locations: locations.map((location) => this.toServiceLocation(location)),
      };
    } catch (error) {
      this.logDevFailure('service locations load failed', error, { contractorId: user.id });
      throw error;
    }
  }

  async updateServiceAreas(user: AuthenticatedUser, body: unknown) {
    this.assertContractor(user);

    try {
      const uniqueLocations = [...new Set(this.extractServiceAreaKeys(body).map((location) => normalizeLocationKey(location)).filter(Boolean))];
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

      this.logDev('service locations saved', { contractorId: user.id, count: locations.length });

      return {
        availableLocations: MALTA_SERVICE_LOCATIONS,
        locations: locations.map((location) => this.toServiceLocation(location)),
      };
    } catch (error) {
      this.logDevFailure('service locations save failed', error, { contractorId: user.id });
      throw error;
    }
  }

  async serviceCategories(user: AuthenticatedUser) {
    this.assertContractor(user);

    try {
      const categories = await this.prisma.contractorServiceCategory.findMany({
        where: { contractorId: user.id },
        orderBy: [{ categoryKey: 'asc' }, { subcategoryKey: 'asc' }],
      });

      this.logDev('service categories loaded', { contractorId: user.id, count: categories.length });

      return { categories: categories.map((category) => this.toServiceCategory(category)) };
    } catch (error) {
      this.logDevFailure('service categories load failed', error, { contractorId: user.id });
      throw error;
    }
  }

  async updateServiceCategories(user: AuthenticatedUser, body: unknown) {
    this.assertContractor(user);

    try {
      const unique = new Map<string, ServiceCategorySelection>();
      this.extractServiceCategorySelections(body).forEach((category) => {
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

      this.logDev('service categories saved', { contractorId: user.id, count: categories.length });

      return { categories: categories.map((category) => this.toServiceCategory(category)) };
    } catch (error) {
      this.logDevFailure('service categories save failed', error, { contractorId: user.id });
      throw error;
    }
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

  private extractServiceAreaKeys(body: unknown) {
    const items = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.locations) ? body.locations : null;

    if (!items) {
      throw new BadRequestException('Service locations payload must be an array.');
    }

    if (items.length > 30) {
      throw new BadRequestException('You can select up to 30 service locations.');
    }

    return items.map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      if (isRecord(item)) {
        if (typeof item.locationKey === 'string' && item.locationKey.trim()) {
          return item.locationKey;
        }

        if (typeof item.locationLabel === 'string' && item.locationLabel.trim()) {
          return item.locationLabel;
        }
      }

      throw new BadRequestException('Each service location must include a valid location key.');
    });
  }

  private extractServiceCategorySelections(body: unknown): ServiceCategorySelection[] {
    const items = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.categories) ? body.categories : null;

    if (!items) {
      throw new BadRequestException('Service categories payload must be an array.');
    }

    if (items.length > 60) {
      throw new BadRequestException('You can select up to 60 service categories.');
    }

    return items.map((item) => {
      if (!isRecord(item) || typeof item.categoryKey !== 'string' || !item.categoryKey.trim()) {
        throw new BadRequestException('Each service category must include a valid category key.');
      }

      if (item.categoryKey.length > 100) {
        throw new BadRequestException('Service category key is too long.');
      }

      if (
        item.subcategoryKey !== undefined &&
        item.subcategoryKey !== null &&
        (typeof item.subcategoryKey !== 'string' || item.subcategoryKey.length > 100)
      ) {
        throw new BadRequestException('Service subcategory key is invalid.');
      }

      return {
        categoryKey: item.categoryKey,
        subcategoryKey: typeof item.subcategoryKey === 'string' ? item.subcategoryKey : null,
      };
    });
  }

  private logDev(message: string, metadata: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    this.logger.debug(`${message} ${JSON.stringify(metadata)}`);
  }

  private logDevFailure(message: string, error: unknown, metadata: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    this.logger.warn(
      `${message} ${JSON.stringify({
        ...metadata,
        error: error instanceof Error ? error.message : String(error),
      })}`,
    );
  }
}
