import { Injectable, Logger } from '@nestjs/common';
import { Prisma, MotCle } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UnescoService, type UnescoLookup } from './unesco.service.js';

export type KeywordStatus = 'unesco' | 'libre_non_trouve' | 'libre_degrade';

export interface KeywordSelection {
  maxTotal: number;
  minUnesco: number;
}

export interface ResolvedKeyword {
  raw: string;
  libelle: string;
  unescoUri: string | null;
  status: KeywordStatus;
}

export interface KeywordAssociation {
  motCleIds: string[];
  libelles: string[];
  report: ResolvedKeyword[];
  degraded: boolean;
}

/* Mots-clés auto-générés : 6 max, dont au moins 4 descripteurs UNESCO (> la moitié) */
export const AUTO_KEYWORDS_SELECTION: KeywordSelection = { maxTotal: 6, minUnesco: 4 };

@Injectable()
export class MotCleUnescoService {
  private readonly logger = new Logger(MotCleUnescoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly unesco: UnescoService,
  ) {}

  /**
   * 1) mappe chaque mot-clé brut vers un descripteur UNESCO (appels HTTP, hors transaction)
   * 2) upsert dans mots_cles
   * Ne lance pas d'erreur si l'API UNESCO est KO : le mot-clé brut est conservé (isUnesco = false).
   * L'appelant relie ensuite `motCleIds` au mémoire (pivot MemoireMotCle).
   */
  async resolveAndUpsert(rawKeywords: string[], selection?: KeywordSelection): Promise<KeywordAssociation> {
    if (rawKeywords.length === 0) return { motCleIds: [], libelles: [], report: [], degraded: false };

    const lookups = await this.unesco.resolveKeywords(rawKeywords);
    const deduped = this.dedupe(lookups.map((l) => this.toResolved(l)));
    const report = selection ? this.select(deduped, selection) : deduped;

    const rows = new Map<string, MotCle>(); // dédoublonnage par id (deux mots bruts → même descripteur)
    for (const kw of report) {
      const row = kw.unescoUri
        ? await this.upsertUnesco(kw.libelle, kw.unescoUri)
        : await this.upsertLibre(kw.libelle);
      rows.set(row.id, row);
    }

    const degraded = report.some((k) => k.status === 'libre_degrade');
    if (degraded) {
      this.logger.warn(
        `Mode dégradé UNESCO : ${report.filter((k) => k.status === 'libre_degrade').length}/${report.length} mot(s)-clé(s) enregistré(s) sans descripteur`,
      );
    }

    return {
      motCleIds: [...rows.keys()],
      libelles: [...rows.values()].map((r) => r.libelle),
      report,
      degraded,
    };
  }

  /* Descripteurs en priorité (jusqu'à minUnesco), puis mots libres ; complète jusqu'à maxTotal avec le reste */
  private select(items: ResolvedKeyword[], { maxTotal, minUnesco }: KeywordSelection): ResolvedKeyword[] {
    const descripteurs = items.filter((i) => i.status === 'unesco');
    const libres = items.filter((i) => i.status !== 'unesco');
    const nbLibres = maxTotal - minUnesco;

    const picked = [...descripteurs.slice(0, minUnesco), ...libres.slice(0, nbLibres)];
    for (const it of [...descripteurs.slice(minUnesco), ...libres.slice(nbLibres)]) {
      if (picked.length >= maxTotal) break;
      picked.push(it);
    }

    const nbUnesco = picked.filter((i) => i.status === 'unesco').length;
    this.logger.log(`Sélection auto : ${nbUnesco}/${picked.length} descripteurs UNESCO (${items.length} candidats)`);
    return picked;
  }

  /* ───────────────────────── Résolution ───────────────────────── */

  private toResolved(lookup: UnescoLookup): ResolvedKeyword {
    switch (lookup.status) {
      case 'matched':
        return {
          raw: lookup.term,
          libelle: lookup.descriptor.prefLabel,
          unescoUri: lookup.descriptor.uri,
          status: 'unesco',
        };
      case 'not_found':
        return { raw: lookup.term, libelle: lookup.term, unescoUri: null, status: 'libre_non_trouve' };
      case 'unavailable':
        return { raw: lookup.term, libelle: lookup.term, unescoUri: null, status: 'libre_degrade' };
    }
  }

  /** Un descripteur = une entrée ; un mot libre identique (casse près) à un descripteur trouvé est écarté. */
  private dedupe(items: ResolvedKeyword[]): ResolvedKeyword[] {
    const unescoLabels = new Set(items.filter((i) => i.unescoUri).map((i) => i.libelle.toLowerCase()));
    const seen = new Set<string>();
    const out: ResolvedKeyword[] = [];

    for (const it of items) {
      const lower = it.libelle.toLowerCase();
      if (!it.unescoUri && unescoLabels.has(lower)) continue;
      const key = it.unescoUri ?? `libre:${lower}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  }

  /* ───────────────────────── Persistance ───────────────────────── */

  /**
   * Descripteur UNESCO :
   *  - déjà connu par son URI → on le réutilise ;
   *  - sinon un mot libre de même libellé existe → on le « promeut » (URI + isUnesco) pour ne pas créer de doublon ;
   *  - sinon création.
   */
  private async upsertUnesco(libelle: string, unescoUri: string): Promise<MotCle> {
    const byUri = await this.prisma.motCle.findUnique({ where: { unescoUri } });
    if (byUri) return byUri;

    try {
      const libre = await this.prisma.motCle.findFirst({
        where: { unescoUri: null, libelle: { equals: libelle, mode: 'insensitive' } },
      });
      if (libre) {
        return await this.prisma.motCle.update({
          where: { id: libre.id },
          data: { libelle, unescoUri, isUnesco: true },
        });
      }
      return await this.prisma.motCle.create({ data: { libelle, unescoUri, isUnesco: true } });
    } catch (e) {
      // Soumission concurrente : la ligne vient d'être créée entre notre lecture et notre écriture
      if (this.isUniqueViolation(e)) {
        const existing =
          (await this.prisma.motCle.findUnique({ where: { unescoUri } })) ?? (await this.findByLibelle(libelle));
        if (existing) return existing;
      }
      throw e;
    }
  }

  /** Mot-clé libre : réutilise toute ligne de même libellé (même UNESCO), sinon crée. */
  private async upsertLibre(libelle: string): Promise<MotCle> {
    const existing = await this.findByLibelle(libelle);
    if (existing) return existing;

    try {
      return await this.prisma.motCle.create({ data: { libelle } });
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        const again = await this.findByLibelle(libelle);
        if (again) return again;
      }
      throw e;
    }
  }

  private findByLibelle(libelle: string) {
    return this.prisma.motCle.findFirst({ where: { libelle: { equals: libelle, mode: 'insensitive' } } });
  }

  private isUniqueViolation(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
  }
}