import type { ThesaurusId } from './thesaurus.schemas.js';

/* Tokens d'injection */
export const THESAURUS_CONFIG = Symbol('THESAURUS_CONFIG');
export const THESAURUS_STRATEGIES = Symbol('THESAURUS_STRATEGIES');

export type SearchMode = 'exact' | 'prefix';

/** Forme commune renvoyée par toutes les stratégies, quelle que soit l'API (Skosmos ou SPARQL). */
export interface ThesaurusCandidate {
  uri: string;
  prefLabel: string;
  altLabels: string[];
}

/** Contrat d'une stratégie : ne fait que « interroger + normaliser », le choix du meilleur candidat est centralisé. */
export interface ThesaurusStrategy {
  readonly id: ThesaurusId;
  /** Lance une erreur `ThesaurusApiError` en cas de problème réseau / API. */
  search(term: string, mode: SearchMode): Promise<ThesaurusCandidate[]>;
}

export interface ThesaurusMatch {
  uri: string;
  /** Libellé préconisé (descripteur officiel) dans la langue demandée */
  prefLabel: string;
  /** Libellé qui a effectivement matché (≠ prefLabel si synonyme) */
  matchedLabel: string;
  matchType: 'exact' | 'alt' | 'near';
}

export interface ThesaurusDescriptor extends ThesaurusMatch {
  thesaurus: ThesaurusId;
}

export type ThesaurusLookup =
  | { status: 'matched'; term: string; descriptor: ThesaurusDescriptor; /** 0 = thésaurus principal du domaine */ fallbackDepth: number }
  | { status: 'not_found'; term: string; tried: ThesaurusId[] }
  | { status: 'unavailable'; term: string; tried: ThesaurusId[]; reason: string };

export interface ResolveOptions {
  concurrency?: number;
  /** Budget de temps global : au-delà, les mots restants passent en mode dégradé */
  budgetMs?: number;
}

export class ThesaurusApiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ThesaurusApiError';
  }
}

/** Descripteur proposé par un thésaurus (réservoir de complétion, pas encore rattaché à un mot-clé IA) */
export interface DescriptorCandidate {
  thesaurus: ThesaurusId;
  uri: string;
  prefLabel: string;
}

export interface CandidatePoolOptions {
  /** On arrête d'interroger les thésaurus suivants de la chaîne dès que le réservoir atteint cette taille */
  minPool?: number;
  concurrency?: number;
  budgetMs?: number;
}