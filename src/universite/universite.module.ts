import { Module } from '@nestjs/common';
import { UniversiteService } from './universite.service.js';
import { UniversiteController } from './universite.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [UniversiteController],
  providers: [UniversiteService],
  exports: [UniversiteService],
})
export class UniversiteModule {}
