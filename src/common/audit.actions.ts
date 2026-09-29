/**
 * Constante TypeScript représentant les actions auditables.
 * Pas d'enum Prisma, pas de migration nécessaire.
 * La colonne `action` dans AuditLog est un String libre.
 */
export const AuditAction = {
  SUBMIT_MEMOIRE: 'SUBMIT_MEMOIRE',
  VALIDATE_MEMOIRE: 'VALIDATE_MEMOIRE',
  REJECT_MEMOIRE: 'REJECT_MEMOIRE',
  SEARCH: 'SEARCH',
  EXPORT_BIBTEX: 'EXPORT_BIBTEX',
  LOGIN: 'LOGIN',
  REGISTER: 'REGISTER',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
