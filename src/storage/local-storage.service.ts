import { Injectable, Logger } from '@nestjs/common';
import { IFileStorage } from './storage.interface.js';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LocalFileStorageService implements IFileStorage {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly logger = new Logger(LocalFileStorageService.name);

  constructor() {
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create upload directory', error);
    }
  }

  async uploadFile(file: any, folder: string = ''): Promise<string> {
    const targetDir = path.join(this.uploadDir, folder);
    await fs.mkdir(targetDir, { recursive: true });

    const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(targetDir, fileName);

    await fs.writeFile(filePath, file.buffer);
    
    // Retourne le chemin relatif qui servira d'URL ou d'identifiant
    return path.join('uploads', folder, fileName).replace(/\\/g, '/');
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const fullPath = path.join(process.cwd(), fileUrl);
      await fs.unlink(fullPath);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${fileUrl}`, error);
    }
  }

  getFileUrl(fileUrl: string): string {
    // Dans un cas réel local, l'URL pourrait dépendre d'une route statique
    return `/${fileUrl}`;
  }
}
