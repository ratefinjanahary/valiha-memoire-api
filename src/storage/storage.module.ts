import { Global, Module } from '@nestjs/common';
import { LocalFileStorageService } from './local-storage.service.js';

export const FILE_STORAGE_SERVICE = 'FILE_STORAGE_SERVICE';

@Global()
@Module({
  providers: [
    {
      provide: FILE_STORAGE_SERVICE,
      useClass: LocalFileStorageService,
    },
  ],
  exports: [FILE_STORAGE_SERVICE],
})
export class StorageModule {}
