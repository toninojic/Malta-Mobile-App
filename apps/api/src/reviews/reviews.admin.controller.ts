import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ReviewsService } from './reviews.service';

@Controller({
  path: 'admin',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('reviews')
  reviews(@Query() query: PaginationQueryDto) {
    return this.reviewsService.findAdminReviews(query);
  }

  @Get('reviews/:reviewId')
  review(@Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return this.reviewsService.findAdminReview(reviewId);
  }

  @Patch('reviews/:reviewId/remove')
  removeReview(@CurrentUser() user: AuthenticatedUser, @Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return this.reviewsService.removeReview(user, reviewId);
  }

  @Get('completions')
  completions(@Query() query: PaginationQueryDto) {
    return this.reviewsService.findAdminCompletions(query);
  }

  @Get('completions/:completionId')
  completion(@Param('completionId', ParseUUIDPipe) completionId: string) {
    return this.reviewsService.findAdminCompletion(completionId);
  }
}
