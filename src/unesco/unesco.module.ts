import { Module } from '@nestjs/common';
import { UnescoService } from './unesco.service.js';
import { MotCleUnescoService } from './mot-cle-unesco.service.js';

@Module({
  providers: [UnescoService, MotCleUnescoService],
  exports: [UnescoService, MotCleUnescoService],
})
export class UnescoModule {}