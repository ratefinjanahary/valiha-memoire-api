import { Module } from '@nestjs/common';
import { MotCleService } from './mot-cle.service.js';
import { MotCleController } from './mot-cle.controller.js';
import { MemoryCacheService } from '../common/memory.cache.service.js';

@Module({
  providers: [MotCleService, MemoryCacheService],
  controllers: [MotCleController],
})
export class MotCleModule {}
