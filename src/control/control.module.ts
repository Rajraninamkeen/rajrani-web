import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ControlService } from './control.service';
import { ControlController } from './control.controller';

/** Session 43 — Platform Control Panel (OPERATOR/ADMIN governance + break-glass). */
@Module({
  imports: [AuthModule],
  providers: [ControlService],
  controllers: [ControlController],
  exports: [ControlService],
})
export class ControlModule {}
