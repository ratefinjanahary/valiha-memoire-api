import { BadRequestException, FileValidator, MaxFileSizeValidator, ParseFilePipe } from '@nestjs/common';
import 'multer';

export const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5 Mo

/** Vérifie le mimetype ET la signature magique (%PDF-) : le mimetype seul est falsifiable. */
export class PdfFileValidator extends FileValidator<Record<string, never>> {
  constructor() {
    super({});
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file?.buffer) return false;
    return (
      file.mimetype === 'application/pdf' &&
      file.buffer.subarray(0, 5).toString('latin1') === '%PDF-'
    );
  }

  buildErrorMessage(): string {
    return 'Le fichier doit être un PDF valide';
  }
}

export const pdfParseFilePipe = () =>
  new ParseFilePipe({
    fileIsRequired: true,
    validators: [
      new MaxFileSizeValidator({
        maxSize: MAX_PDF_SIZE,
        message: 'Le fichier ne doit pas dépasser 5 Mo',
      }),
      new PdfFileValidator(),
    ],
    exceptionFactory: (message) => new BadRequestException(message),
  });