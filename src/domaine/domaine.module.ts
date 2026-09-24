import { Module } from '@nestjs/common';
import { DomaineService } from './domaine.service.js';
import { DomaineController } from './domaine.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [DomaineController],
  providers: [DomaineService],
  exports: [DomaineService],
})
export class DomaineModule {}
