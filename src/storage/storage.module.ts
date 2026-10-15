import { Global, Module } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service.js';

export const FILE_STORAGE_SERVICE = 'FILE_STORAGE_SERVICE';

@Global()
@Module({
  providers: [
    GoogleDriveService,
    { provide: FILE_STORAGE_SERVICE, useExisting: GoogleDriveService },
  ],
  exports: [FILE_STORAGE_SERVICE],
})
export class StorageModule {}