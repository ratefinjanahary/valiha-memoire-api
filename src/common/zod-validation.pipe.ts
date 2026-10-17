import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valide (et transforme) une donnée entrante avec un schéma Zod.
 * Usage : @Body(new ZodValidationPipe(updateMemoireSchema)) body: UpdateMemoireInput
 */
@Injectable()
export class ZodValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Données invalides',
        errors: result.error.issues.map((issue) => ({
          champ: issue.path.join('.') || '(racine)',
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}