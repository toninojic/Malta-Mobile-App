import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UploadsService, UploadedImageFile } from './uploads.service';

@Controller({
  path: 'uploads',
  version: '1',
})
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('job-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5,
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
  async uploadJobImages(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: UploadedImageFile[],
    @Req() request: { protocol: string; get: (header: string) => string | undefined },
    @Headers('x-forwarded-proto') forwardedProto?: string,
  ) {
    return this.uploadsService.storeJobImages(files ?? [], user.id, baseUrl(request, forwardedProto));
  }

  @Get('job-images/:ownerId/:fileName')
  async getScopedJobImage(
    @Param('ownerId') ownerId: string,
    @Param('fileName') fileName: string,
    @Res() response: Response,
  ) {
    const image = await this.uploadsService.readJobImage(ownerId, fileName);
    response.type(image.contentType);
    image.stream.pipe(response);
  }

  @Get('job-images/:fileName')
  async getJobImage(@Param('fileName') fileName: string, @Res() response: Response) {
    const image = await this.uploadsService.readLegacyJobImage(fileName);
    response.type(image.contentType);
    image.stream.pipe(response);
  }

  @Get('avatars/:ownerId/:fileName')
  async getScopedAvatar(
    @Param('ownerId') ownerId: string,
    @Param('fileName') fileName: string,
    @Res() response: Response,
  ) {
    const image = await this.uploadsService.readAvatar(ownerId, fileName);
    response.type(image.contentType);
    image.stream.pipe(response);
  }

  @Get('avatars/:fileName')
  async getAvatar(@Param('fileName') fileName: string, @Res() response: Response) {
    const image = await this.uploadsService.readLegacyAvatar(fileName);
    response.type(image.contentType);
    image.stream.pipe(response);
  }

  @Get('portfolio/:ownerId/:fileName')
  async getScopedPortfolioImage(
    @Param('ownerId') ownerId: string,
    @Param('fileName') fileName: string,
    @Res() response: Response,
  ) {
    const image = await this.uploadsService.readPortfolioImage(ownerId, fileName);
    response.type(image.contentType);
    image.stream.pipe(response);
  }

  @Get('portfolio/:fileName')
  async getPortfolioImage(@Param('fileName') fileName: string, @Res() response: Response) {
    const image = await this.uploadsService.readLegacyPortfolioImage(fileName);
    response.type(image.contentType);
    image.stream.pipe(response);
  }

  @Get('verification-documents/:ownerId/:fileName')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getScopedVerificationDocument(
    @Param('ownerId') ownerId: string,
    @Param('fileName') fileName: string,
    @Res() response: Response,
  ) {
    const document = await this.uploadsService.readVerificationDocument(ownerId, fileName);
    response.type(document.contentType);
    document.stream.pipe(response);
  }

  @Get('verification-documents/:fileName')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getVerificationDocument(@Param('fileName') fileName: string, @Res() response: Response) {
    const document = await this.uploadsService.readLegacyVerificationDocument(fileName);
    response.type(document.contentType);
    document.stream.pipe(response);
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
