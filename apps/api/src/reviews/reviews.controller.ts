import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReviewsService } from './reviews.service';

@Controller({
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('contacts/:contactId/complete')
  @Roles(UserRole.CONTRACTOR)
  markComplete(@CurrentUser() user: AuthenticatedUser, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.reviewsService.markComplete(user, contactId);
  }

  @Post('contacts/:contactId/confirm-completion')
  @Roles(UserRole.EMPLOYER)
  confirmCompletion(@CurrentUser() user: AuthenticatedUser, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.reviewsService.confirmCompletion(user, contactId);
  }

  @Get('contacts/:contactId/completion-status')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR)
  completionStatus(@CurrentUser() user: AuthenticatedUser, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.reviewsService.getCompletionStatus(user, contactId);
  }

  @Post('contacts/:contactId/review')
  @Roles(UserRole.EMPLOYER)
  createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(user, contactId, dto);
  }

  @Get('contractors/:contractorId/reviews')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN)
  contractorReviews(@Param('contractorId', ParseUUIDPipe) contractorId: string, @Query() query: PaginationQueryDto) {
    return this.reviewsService.findContractorReviews(contractorId, query);
  }

  @Get('contractors/:contractorId/rating-summary')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN)
  contractorRatingSummary(@Param('contractorId', ParseUUIDPipe) contractorId: string) {
    return this.reviewsService.getRatingSummary(contractorId);
  }

  @Get('contractors/:contractorId/profile')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN)
  contractorProfile(@CurrentUser() user: AuthenticatedUser, @Param('contractorId', ParseUUIDPipe) contractorId: string) {
    return this.reviewsService.getContractorProfile(user, contractorId);
  }

  @Patch('reviews/:reviewId/reply')
  @Roles(UserRole.CONTRACTOR)
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviewsService.replyToReview(user, reviewId, dto);
  }

  @Get('reviews/:reviewId')
  @Roles(UserRole.EMPLOYER, UserRole.CONTRACTOR, UserRole.ADMIN)
  review(@CurrentUser() user: AuthenticatedUser, @Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return this.reviewsService.findReviewForUser(user, reviewId);
  }
}
