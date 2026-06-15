import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ContractorPortfolioImage,
  ContractorVerification,
  ContractorVerificationStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PaginatedResponse, PaginationQueryDto, paginationMeta } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { isStorageKey } from '../modules/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadedImageFile, UploadsService } from '../uploads/uploads.service';

@Injectable()
export class ContractorVerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async myPortfolio(user: AuthenticatedUser) {
    this.assertContractor(user);

    const images = await this.prisma.contractorPortfolioImage.findMany({
      where: { contractorId: user.id },
      orderBy: { sortOrder: 'asc' },
    });

    return images.map((image) => this.toPortfolioImage(image));
  }

  async addPortfolioImages(user: AuthenticatedUser, files: UploadedImageFile[], baseUrl: string) {
    this.assertContractor(user);

    const existingCount = await this.prisma.contractorPortfolioImage.count({
      where: { contractorId: user.id },
    });
    if (existingCount + files.length > 10) {
      throw new BadRequestException('You can upload up to 10 portfolio images.');
    }

    const uploaded = (await this.uploadsService.storePortfolioImages(files, user.id, baseUrl)).images;
    const created = await this.prisma.$transaction(
      uploaded.map((image, index) =>
        this.prisma.contractorPortfolioImage.create({
          data: {
            contractorId: user.id,
            url: image.url,
            sortOrder: existingCount + index,
          },
        }),
      ),
    );

    return created.map((image) => this.toPortfolioImage(image));
  }

  async addPortfolioImageKeys(user: AuthenticatedUser, imageKeys: string[]) {
    this.assertContractor(user);

    if (!imageKeys.length) {
      throw new BadRequestException('Select at least one portfolio image.');
    }
    imageKeys.forEach((key) => this.assertPortfolioKey(user, key));

    const existingCount = await this.prisma.contractorPortfolioImage.count({
      where: { contractorId: user.id },
    });
    if (existingCount + imageKeys.length > 10) {
      throw new BadRequestException('You can upload up to 10 portfolio images.');
    }

    const created = await this.prisma.$transaction(
      imageKeys.map((key, index) =>
        this.prisma.contractorPortfolioImage.create({
          data: {
            contractorId: user.id,
            url: key,
            sortOrder: existingCount + index,
          },
        }),
      ),
    );

    return created.map((image) => this.toPortfolioImage(image));
  }

  async removePortfolioImage(user: AuthenticatedUser, imageId: string) {
    this.assertContractor(user);

    const image = await this.prisma.contractorPortfolioImage.findUnique({
      where: { id: imageId },
    });
    if (!image) {
      throw new NotFoundException('Portfolio image not found.');
    }
    if (image.contractorId !== user.id) {
      throw new ForbiddenException('You can remove only your own portfolio images.');
    }

    await this.prisma.contractorPortfolioImage.delete({
      where: { id: imageId },
    });

    return { success: true };
  }

  async myVerification(user: AuthenticatedUser) {
    this.assertContractor(user);

    const verification = await this.latestVerification(user.id);
    return verification
      ? this.toVerification(verification, false)
      : {
          status: ContractorVerificationStatus.UNVERIFIED,
        };
  }

  async submitVerification(user: AuthenticatedUser, file: UploadedImageFile | undefined, baseUrl: string) {
    this.assertContractor(user);

    const latest = await this.latestVerification(user.id);
    if (latest?.status === ContractorVerificationStatus.PENDING_REVIEW) {
      throw new BadRequestException('Your verification document is already pending review.');
    }
    if (latest?.status === ContractorVerificationStatus.VERIFIED) {
      throw new BadRequestException('Your contractor account is already verified.');
    }

    const stored = await this.uploadsService.storeVerificationDocument(file, user.id, baseUrl);
    const verification = await this.prisma.contractorVerification.create({
      data: {
        contractorId: user.id,
        documentUrl: stored.documentUrl,
        documentMimeType: stored.mimeType,
        status: ContractorVerificationStatus.PENDING_REVIEW,
      },
      include: verificationInclude,
    });

    return this.toVerification(verification, false);
  }

  async submitVerificationKey(user: AuthenticatedUser, documentKey: string, documentMimeType: string) {
    this.assertContractor(user);
    this.assertVerificationKey(user, documentKey);
    this.assertVerificationMimeType(documentMimeType);

    const latest = await this.latestVerification(user.id);
    if (latest?.status === ContractorVerificationStatus.PENDING_REVIEW) {
      throw new BadRequestException('Your verification document is already pending review.');
    }
    if (latest?.status === ContractorVerificationStatus.VERIFIED) {
      throw new BadRequestException('Your contractor account is already verified.');
    }

    const verification = await this.prisma.contractorVerification.create({
      data: {
        contractorId: user.id,
        documentUrl: documentKey,
        documentMimeType,
        status: ContractorVerificationStatus.PENDING_REVIEW,
      },
      include: verificationInclude,
    });

    return this.toVerification(verification, false);
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponse<ReturnType<ContractorVerificationsService['toVerification']>>> {
    const [verifications, total] = await this.prisma.$transaction([
      this.prisma.contractorVerification.findMany({
        include: verificationInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.contractorVerification.count(),
    ]);

    return {
      data: verifications.map((verification) => this.toVerification(verification, true)),
      pagination: paginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string) {
    const verification = await this.prisma.contractorVerification.findUnique({
      where: { id },
      include: verificationInclude,
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found.');
    }

    return this.toVerification(verification, true);
  }

  async approve(admin: AuthenticatedUser, id: string) {
    this.assertAdmin(admin);
    const verification = await this.getVerificationOrThrow(id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const approved = await tx.contractorVerification.update({
        where: { id },
        data: {
          status: ContractorVerificationStatus.VERIFIED,
          adminNote: null,
          reviewedByAdminId: admin.id,
          reviewedAt: new Date(),
        },
        include: verificationInclude,
      });

      await this.notificationsService.create(
        {
          userId: verification.contractorId,
          type: NotificationType.CONTRACTOR_VERIFICATION_APPROVED,
          title: 'Contractor verification approved',
          body: 'Your contractor account is now verified.',
          data: {
            verificationId: verification.id,
            target: 'contractorVerification',
          },
        },
        tx,
      );

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: 'CONTRACTOR_VERIFICATION_APPROVED',
          entityType: 'ContractorVerification',
          entityId: verification.id,
          metadata: {
            contractorId: verification.contractorId,
          },
        },
        tx,
      );

      return approved;
    });

    return this.toVerification(updated, true);
  }

  async reject(admin: AuthenticatedUser, id: string, adminNote?: string) {
    this.assertAdmin(admin);
    const verification = await this.getVerificationOrThrow(id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const rejected = await tx.contractorVerification.update({
        where: { id },
        data: {
          status: ContractorVerificationStatus.REJECTED,
          adminNote: adminNote?.trim() || null,
          reviewedByAdminId: admin.id,
          reviewedAt: new Date(),
        },
        include: verificationInclude,
      });

      await this.notificationsService.create(
        {
          userId: verification.contractorId,
          type: NotificationType.CONTRACTOR_VERIFICATION_REJECTED,
          title: 'Contractor verification rejected',
          body: 'Your contractor verification needs another document.',
          data: {
            verificationId: verification.id,
            target: 'contractorVerification',
          },
        },
        tx,
      );

      await this.auditLogsService.create(
        {
          adminId: admin.id,
          action: 'CONTRACTOR_VERIFICATION_REJECTED',
          entityType: 'ContractorVerification',
          entityId: verification.id,
          metadata: {
            contractorId: verification.contractorId,
            adminNote: adminNote?.trim() || null,
          },
        },
        tx,
      );

      return rejected;
    });

    return this.toVerification(updated, true);
  }

  private latestVerification(contractorId: string) {
    return this.prisma.contractorVerification.findFirst({
      where: { contractorId },
      include: verificationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getVerificationOrThrow(id: string) {
    const verification = await this.prisma.contractorVerification.findUnique({
      where: { id },
      include: verificationInclude,
    });

    if (!verification) {
      throw new NotFoundException('Verification request not found.');
    }

    return verification;
  }

  private assertContractor(user: AuthenticatedUser) {
    if (user.role !== UserRole.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can use this resource.');
    }
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can review contractor verifications.');
    }
  }

  private toPortfolioImage(image: ContractorPortfolioImage) {
    return {
      id: image.id,
      contractorId: image.contractorId,
      key: image.url,
      url: image.url,
      sortOrder: image.sortOrder,
      createdAt: image.createdAt,
    };
  }

  private toVerification(verification: VerificationWithRelations, admin: boolean) {
    return {
      id: verification.id,
      contractorId: verification.contractorId,
      documentKey: admin ? verification.documentUrl : undefined,
      documentUrl: admin ? verification.documentUrl : undefined,
      documentMimeType: admin ? verification.documentMimeType : undefined,
      status: verification.status,
      adminNote: verification.adminNote,
      reviewedByAdminId: verification.reviewedByAdminId,
      reviewedAt: verification.reviewedAt,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
      contractor: admin ? verification.contractor : undefined,
      reviewedByAdmin: admin ? verification.reviewedByAdmin : undefined,
    };
  }

  private assertPortfolioKey(user: AuthenticatedUser, key: string) {
    if (!isStorageKey(key) || !key.startsWith(`portfolio/${user.id}/`)) {
      throw new BadRequestException('Invalid portfolio image key.');
    }
  }

  private assertVerificationKey(user: AuthenticatedUser, key: string) {
    if (!isStorageKey(key) || !key.startsWith(`verification/${user.id}/`)) {
      throw new BadRequestException('Invalid verification document key.');
    }
  }

  private assertVerificationMimeType(documentMimeType: string) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(documentMimeType)) {
      throw new BadRequestException('Only jpg, jpeg, png, webp, and pdf documents are allowed.');
    }
  }
}

const verificationInclude = {
  contractor: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      profile: true,
    },
  },
  reviewedByAdmin: {
    select: {
      id: true,
      email: true,
      profile: true,
    },
  },
};

type VerificationWithRelations = ContractorVerification & {
  contractor?: unknown;
  reviewedByAdmin?: unknown;
};
