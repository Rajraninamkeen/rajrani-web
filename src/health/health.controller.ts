import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkApp(),
    ]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { postgres: { status: 'up' } };
    } catch {
      return { postgres: { status: 'down' } };
    }
  }

  private checkApp(): HealthIndicatorResult {
    return {
      app: {
        status: 'up',
        name: 'bilokat-api',
        env: this.config.get<string>('env') ?? 'development',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
