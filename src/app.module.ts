import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SearchModule } from './search/search.module.js';
import { GraphModule } from './graph/graph.module.js';
import { MemoireModule } from './memoire/memoire.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { UniversiteModule } from './universite/universite.module.js';
import { DomaineModule } from './domaine/domaine.module.js';
import { AuditModule } from './audit/audit.module.js';
import { MotCleModule } from './mot-cle/mot-cle.module.js';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    // AuditModule DOIT être importé en premier car il est @Global()
    // et fournit AuditService à tous les autres modules
    AuditModule,
    AuthModule,
    SearchModule,
    GraphModule,
    MemoireModule,
    AnalyticsModule,
    UniversiteModule,
    DomaineModule,
    MotCleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
