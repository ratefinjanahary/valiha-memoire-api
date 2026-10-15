// storage/google-drive.service.ts
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import * as path from 'path';
import 'multer';
import type { IFileStorage } from './storage.interface.js';

@Injectable()
export class GoogleDriveService implements IFileStorage {
  private readonly logger = new Logger(GoogleDriveService.name);
  private readonly drive: drive_v3.Drive;
  private readonly folderId: string;

  constructor(private readonly config: ConfigService) {
    this.folderId = this.config.getOrThrow<string>('GOOGLE_DRIVE_FOLDER_ID');
    this.drive = google.drive({ version: 'v3', auth: this.buildAuth() });
  }

  private buildAuth() {
    const refreshToken = this.config.get<string>('GOOGLE_OAUTH_REFRESH_TOKEN');

    // Mode B : OAuth2 (fichiers détenus par ton compte Google)
    if (refreshToken) {
      const client = new google.auth.OAuth2(
        this.config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_ID'),
        this.config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_SECRET'),
      );
      client.setCredentials({ refresh_token: refreshToken });
      return client;
    }

    // Mode A : Service Account
    return new google.auth.GoogleAuth({
      keyFile: path.resolve(this.config.getOrThrow<string>('GOOGLE_SERVICE_ACCOUNT_KEY_PATH')),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }

  /** Upload un PDF, le rend lisible par quiconque a le lien, retourne le webViewLink. */
  async uploadPdf(file: Express.Multer.File): Promise<string> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    let fileId: string | undefined;

    try {
      const { data } = await this.drive.files.create({
        requestBody: {
          name: `${Date.now()}-${safeName}`,
          parents: [this.folderId],
          mimeType: 'application/pdf',
        },
        media: {
          mimeType: 'application/pdf',
          body: Readable.from([file.buffer]), // buffer Multer → stream lisible
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });

      if (!data.id || !data.webViewLink) {
        throw new Error('Réponse Google Drive incomplète');
      }
      fileId = data.id;

      await this.drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      });

      return data.webViewLink;
    } catch (error) {
      this.logger.error('Échec de l\'upload vers Google Drive', error);
      // Évite de laisser un fichier créé mais non partagé
      if (fileId) await this.deleteFile(fileId);
      throw new BadGatewayException('Impossible d\'envoyer le fichier vers Google Drive');
    }
  }

  /** Accepte un webViewLink ou un fileId brut. Ne lève pas d'erreur (comme l'implémentation locale). */
  async deleteFile(urlOrId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId: GoogleDriveService.extractFileId(urlOrId),
        supportsAllDrives: true,
      });
    } catch (error) {
      this.logger.error(`Échec de suppression Drive : ${urlOrId}`, error);
    }
  }

  static extractFileId(urlOrId: string): string {
    // https://drive.google.com/file/d/<ID>/view?usp=drivesdk
    return urlOrId.match(/\/d\/([^/?]+)/)?.[1] ?? urlOrId;
  }

  // --- Compatibilité IFileStorage ---
  uploadFile(file: Express.Multer.File, _folder?: string): Promise<string> {
    return this.uploadPdf(file);
  }

  getFileUrl(fileUrl: string): string {
    return fileUrl; // déjà une URL absolue
  }
}