import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActivityModule } from './activity/activity.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ContactsModule } from './contacts/contacts.module';
import { ContractorsModule } from './contractors/contractors.module';
import { ContractorVerificationsModule } from './contractor-verifications/contractor-verifications.module';
import { ConversationsModule } from './conversations/conversations.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OffersModule } from './offers/offers.module';
import { PaymentsModule } from './payments/payments.module';
import { PushModule } from './push/push.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { TokensModule } from './tokens/tokens.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { ErrorTrackingService } from './common/error-tracking.service';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { StorageModule } from './modules/storage/storage.module';
import { StorageResponseInterceptor } from './modules/storage/storage-response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    JobsModule,
    OffersModule,
    PaymentsModule,
    TokensModule,
    ActivityModule,
    ContactsModule,
    ContractorsModule,
    ContractorVerificationsModule,
    NotificationsModule,
    PushModule,
    ConversationsModule,
    MessagesModule,
    ReviewsModule,
    UploadsModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: StorageResponseInterceptor,
    },
    ErrorTrackingService,
  ],
})
export class AppModule {}
