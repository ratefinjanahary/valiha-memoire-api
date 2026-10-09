import { Module } from '@nestjs/common';
import { EncadreurController } from './encadreur.controller.js';
import { EncadreurService } from './encadreur.service.js';

// Si PrismaModule n'est pas @Global(), l'ajouter dans `imports`.
@Module({
  controllers: [EncadreurController],
  providers: [EncadreurService],
  exports: [EncadreurService],
})
export class EncadreurModule {}
