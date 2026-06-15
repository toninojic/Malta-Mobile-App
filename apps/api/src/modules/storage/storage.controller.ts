import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { DeleteStorageObjectDto } from './dto/delete-storage-object.dto';
import { ViewUrlQueryDto } from './dto/view-url-query.dto';
import { StorageService } from './storage.service';

@Controller({
  path: 'storage',
  version: '1',
})
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload-url')
  createUploadUrl(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUploadUrlDto) {
    return this.storageService.createUploadUrl(user, dto);
  }

  @Get('view-url')
  createViewUrl(@CurrentUser() user: AuthenticatedUser, @Query() query: ViewUrlQueryDto) {
    return this.storageService.createViewUrl(user, query.key);
  }

  @Delete()
  deleteObject(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteStorageObjectDto) {
    return this.storageService.deleteObject(user, dto.key);
  }
}
