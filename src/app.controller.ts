import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  getRoot() {
    return {
      name: 'bilokat-api',
      message: 'BILOKAT Central Backend',
      version: '0.1.0',
      env: this.config.get<string>('env'),
      health: `${this.config.get<string>('apiBaseUrl')}/api/v1/health`,
    };
  }
}
