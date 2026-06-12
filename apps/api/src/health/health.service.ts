import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async check() {
    const [database, storage] = await Promise.all([this.checkDatabase(), this.storageService.checkHealth()]);
    const healthy = database === 'ok' && storage.status === 'ok';

    return {
      status: healthy ? 'ok' : 'degraded',
      database,
      storage: storage.status,
      storageDriver: storage.driver,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok' as const;
    } catch {
      return 'degraded' as const;
    }
  }
}
