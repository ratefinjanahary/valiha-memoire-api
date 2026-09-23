export interface IFileStorage {
  uploadFile(file: any, folder?: string): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
  getFileUrl(fileUrl: string): string;
}
