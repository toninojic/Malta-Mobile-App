import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminContactsController } from './contacts.admin.controller';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ContactsController, AdminContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
