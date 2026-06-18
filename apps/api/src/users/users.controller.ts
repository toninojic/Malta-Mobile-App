import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UploadedImageFile, UploadsService } from '../uploads/uploads.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller({
  path: 'users',
  version: '1',
})
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findMe(user.id);
  }

  @Patch('me/profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Delete('me')
  deactivateMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deactivateAccount(user.id);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
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
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() request: { protocol: string; get: (header: string) => string | undefined },
    @Headers('x-forwarded-proto') forwardedProto?: string,
  ) {
    const protocol = forwardedProto?.split(',')[0]?.trim() || request.protocol;
    const host = request.get('host');
    const baseUrl = `${protocol}://${host}/api/v1`;
    const avatar = await this.uploadsService.storeAvatar(file, user.id, baseUrl);
    return this.usersService.updateAvatar(user.id, avatar.avatarUrl);
  }
}
