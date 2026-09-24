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

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    SearchModule,
    GraphModule,
    MemoireModule,
    AnalyticsModule,
    UniversiteModule,
    DomaineModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
