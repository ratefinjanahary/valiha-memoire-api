import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PasswordResetModule } from './pswd-reset/password-reset.module.js';
import { EncadreurModule } from './encadreur/encadreur.module.js';
import { SearchModule } from './search/search.module.js';
import { GraphModule } from './graph/graph.module.js';
import { MemoireModule } from './memoire/memoire.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { UniversiteModule } from './universite/universite.module.js';
import { DomaineModule } from './domaine/domaine.module.js';
import { AuditModule } from './audit/audit.module.js';
import { MotCleModule } from './mot-cle/mot-cle.module.js';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    PrismaModule,
    StorageModule,
    AuditModule,
    AuthModule,
    PasswordResetModule,
    EncadreurModule,
    SearchModule,
    GraphModule,
    MemoireModule,
    AnalyticsModule,
    UniversiteModule,
    DomaineModule,
    MotCleModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe }
  ],
})
export class AppModule {}
