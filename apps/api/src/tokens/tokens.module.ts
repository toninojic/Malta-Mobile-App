import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTokensController } from './tokens.admin.controller';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';

@Module({
  imports: [PrismaModule],
  controllers: [TokensController, AdminTokensController],
  providers: [TokensService],
})
export class TokensModule {}
