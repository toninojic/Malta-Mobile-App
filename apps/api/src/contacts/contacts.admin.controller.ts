import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminContactsQueryDto } from './dto/admin-contacts-query.dto';
import { ContactsService } from './contacts.service';

@Controller({
  path: 'admin/contacts',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  contacts(@Query() query: AdminContactsQueryDto) {
    return this.contactsService.findAdminContacts(query);
  }

  @Get(':id')
  contact(@Param('id', ParseUUIDPipe) id: string) {
    return this.contactsService.findAdminContact(id);
  }
}
