import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobRequest, JobStatus, Prisma, UserRole } from '@prisma/client';
import { paginationMeta } from '../common/dto/pagination-query.dto';
import { assertValidServiceCategory } from '../common/service-categories';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { BrowseJobsQueryDto } from './dto/browse-jobs-query.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

const jobInclude = {
  images: {
    orderBy: { sortOrder: 'asc' as const },
  },
  employer: {
    select: {
      id: true,
      email: true,
      profile: true,
    },
  },
};

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async browse(user: AuthenticatedUser, query: BrowseJobsQueryDto) {
    if (user.role !== UserRole.CONTRACTOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only contractors can browse job requests.');
    }

    if (query.subcategory && !query.category) {
      throw new BadRequestException('Select a category before filtering by subcategory.');
    }
    if (query.category) {
      assertValidServiceCategory(query.category, query.subcategory);
    }

    await this.expireStaleJobs();

    const where: Prisma.JobRequestWhereInput = {
      ...(user.role === UserRole.ADMIN ? {} : { status: JobStatus.ACTIVE }),
      ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
      ...(query.subcategory ? { subcategory: { equals: query.subcategory, mode: 'insensitive' } } : {}),
      ...(query.location ? { location: { contains: query.location, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.jobRequest.findMany({
        where,
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: query.sortBy === 'oldest' ? 'asc' : 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.jobRequest.count({ where }),
    ]);

    return {
      data: data.map((job) => this.toBrowseJob(job)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async create(user: AuthenticatedUser, dto: CreateJobDto) {
    this.assertEmployer(user);
    assertValidServiceCategory(dto.category, dto.subcategory);

    const expiresAt = this.expirationDate();

    return this.prisma.jobRequest.create({
      data: {
        employerId: user.id,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        subcategory: dto.subcategory,
        location: dto.location,
        expiresAt,
        images: this.toImageCreate(dto.imageKeys ?? dto.imageUrls),
      },
      include: jobInclude,
    });
  }

  async findMine(user: AuthenticatedUser) {
    this.assertEmployerOrAdmin(user);
    await this.expireStaleJobs();

    return this.prisma.jobRequest.findMany({
      where: user.role === UserRole.ADMIN ? undefined : { employerId: user.id },
      include: jobInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForOwnerOrAdmin(user: AuthenticatedUser, id: string) {
    this.assertEmployerOrAdmin(user);
    return this.getOwnedJobOrThrow(user, id);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    if (user.role === UserRole.CONTRACTOR) {
      await this.expireStaleJobs();

      const job = await this.prisma.jobRequest.findUnique({
        where: { id },
        include: {
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!job) {
        throw new NotFoundException('Job request not found.');
      }

      const hasOwnOffer = await this.prisma.offer.count({
        where: {
          jobRequestId: id,
          contractorId: user.id,
        },
      });

      if (!hasOwnOffer && (job.status !== JobStatus.ACTIVE || job.expiresAt <= new Date())) {
        throw new NotFoundException('Job request not found.');
      }

      return this.toBrowseJob(job);
    }

    this.assertEmployerOrAdmin(user);
    return this.getOwnedJobOrThrow(user, id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateJobDto) {
    const job = await this.getOwnedJobOrThrow(user, id);
    this.assertEditable(job.status);
    assertValidServiceCategory(dto.category ?? job.category, dto.subcategory ?? job.subcategory);

    const imageMutation =
      dto.imageUrls === undefined && dto.imageKeys === undefined
        ? {}
        : {
            images: {
              deleteMany: {},
              create: (dto.imageKeys ?? dto.imageUrls ?? []).map((url, sortOrder) => ({
                url,
                sortOrder,
              })),
            },
          };

    return this.prisma.jobRequest.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        subcategory: dto.subcategory,
        location: dto.location,
        ...imageMutation,
      },
      include: jobInclude,
    });
  }

  async renew(user: AuthenticatedUser, id: string) {
    const job = await this.getOwnedJobOrThrow(user, id);

    if (job.status === JobStatus.COMPLETED) {
      throw new BadRequestException('Completed jobs cannot be renewed.');
    }

    return this.prisma.jobRequest.update({
      where: { id },
      data: {
        status: JobStatus.ACTIVE,
        expiresAt: this.expirationDate(),
      },
      include: jobInclude,
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    await this.getOwnedJobOrThrow(user, id);

    const job = await this.prisma.jobRequest.update({
      where: { id },
      data: {
        status: JobStatus.CLOSED,
      },
      include: jobInclude,
    });

    return {
      success: true,
      job,
    };
  }

  private async getOwnedJobOrThrow(user: AuthenticatedUser, id: string) {
    this.assertEmployerOrAdmin(user);
    await this.expireStaleJobs();

    const job = await this.prisma.jobRequest.findUnique({
      where: { id },
      include: jobInclude,
    });

    if (!job) {
      throw new NotFoundException('Job request not found.');
    }

    if (user.role !== UserRole.ADMIN && job.employerId !== user.id) {
      throw new ForbiddenException('You can access only your own job requests.');
    }

    return job;
  }

  private assertEmployerOrAdmin(user: AuthenticatedUser) {
    if (user.role !== UserRole.EMPLOYER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only employers can manage job requests.');
    }
  }

  private assertEmployer(user: AuthenticatedUser) {
    if (user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenException('Only employers can create job requests.');
    }
  }

  private assertEditable(status: JobStatus) {
    if (status === JobStatus.COMPLETED || status === JobStatus.CLOSED) {
      throw new BadRequestException(`Cannot edit a ${status.toLowerCase()} job request.`);
    }
  }

  private expirationDate() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    return expiresAt;
  }

  private async expireStaleJobs() {
    await this.prisma.jobRequest.updateMany({
      where: {
        status: JobStatus.ACTIVE,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: JobStatus.EXPIRED,
      },
    });
  }

  private toImageCreate(imageUrls?: string[]): Prisma.JobImageCreateNestedManyWithoutJobRequestInput | undefined {
    if (!imageUrls?.length) {
      return undefined;
    }

    return {
      create:
        imageUrls.map((url, sortOrder) => ({
          url,
          sortOrder,
        })),
    };
  }

  private toBrowseJob(job: JobRequest & { images: { id: string; url: string; sortOrder: number; createdAt: Date; jobRequestId: string }[] }) {
    return {
      id: job.id,
      title: job.title,
      description: job.description,
      category: job.category,
      subcategory: job.subcategory,
      location: job.location,
      status: job.status,
      expiresAt: job.expiresAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      images: job.images,
    };
  }
}
