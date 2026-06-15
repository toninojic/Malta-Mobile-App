import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UploadedImageFile } from '../uploads/uploads.service';
import { AddPortfolioImageKeysDto } from './dto/add-portfolio-image-keys.dto';
import { SubmitVerificationKeyDto } from './dto/submit-verification-key.dto';
import { ContractorVerificationsService } from './contractor-verifications.service';

@Controller({
  path: 'users',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONTRACTOR)
export class ContractorVerificationsController {
  constructor(private readonly contractorVerificationsService: ContractorVerificationsService) {}

  @Get('me/portfolio-images')
  myPortfolio(@CurrentUser() user: AuthenticatedUser) {
    return this.contractorVerificationsService.myPortfolio(user);
  }

  @Post('me/portfolio-images')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 10,
      },
      fileFilter: (_request, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          callback(new BadRequestException('Only jpg, jpeg, png, and webp images are allowed.'), false);
          return;
        }

        callback(null, true);
      },
    }),
  )
  addPortfolioImages(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddPortfolioImageKeysDto,
    @UploadedFiles() files: UploadedImageFile[],
    @Req() request: { protocol: string; get: (header: string) => string | undefined },
    @Headers('x-forwarded-proto') forwardedProto?: string,
  ) {
    if (dto?.imageKeys?.length) {
      return this.contractorVerificationsService.addPortfolioImageKeys(user, dto.imageKeys);
    }

    return this.contractorVerificationsService.addPortfolioImages(user, files ?? [], baseUrl(request, forwardedProto));
  }

  @Delete('me/portfolio-images/:imageId')
  removePortfolioImage(@CurrentUser() user: AuthenticatedUser, @Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.contractorVerificationsService.removePortfolioImage(user, imageId);
  }

  @Get('me/contractor-verification')
  myVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.contractorVerificationsService.myVerification(user);
  }

  @Post('me/contractor-verification')
  @UseInterceptors(
    FileInterceptor('document', {
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
      },
      fileFilter: (_request, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) {
          callback(new BadRequestException('Only jpg, jpeg, png, webp, and pdf documents are allowed.'), false);
          return;
        }

        callback(null, true);
      },
    }),
  )
  submitVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitVerificationKeyDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() request: { protocol: string; get: (header: string) => string | undefined },
    @Headers('x-forwarded-proto') forwardedProto?: string,
  ) {
    if (dto?.documentKey && dto.documentMimeType) {
      return this.contractorVerificationsService.submitVerificationKey(user, dto.documentKey, dto.documentMimeType);
    }

    return this.contractorVerificationsService.submitVerification(user, file, baseUrl(request, forwardedProto));
  }
}

function baseUrl(
  request: { protocol: string; get: (header: string) => string | undefined },
  forwardedProto?: string,
) {
  const protocol = forwardedProto?.split(',')[0]?.trim() || request.protocol;
  const host = request.get('host');
  return `${protocol}://${host}/api/v1`;
}
