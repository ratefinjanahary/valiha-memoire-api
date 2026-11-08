import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type MotCle } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ThesaurusId } from './thesaurus.schemas.js';
import { ThesaurusRoutingService } from './thesaurus-routing.service.js';
import type { ThesaurusLookup } from './thesaurus.types.js';

export type KeywordStatus = 'descripteur' | 'libre_non_trouve' | 'libre_degrade';

export interface KeywordSelection {
  maxTotal: number;
  /** Nombre minimal de descripteurs de thésaurus (toutes sources confondues) */
  minDescripteurs: number;
}

export interface ResolvedKeyword {
  raw: string;
  libelle: string;
  thesaurus: ThesaurusId | null;
  descripteurUri: string | null;
  status: KeywordStatus;
}

export interface KeywordAssociation {
  motCleIds: string[];
  libelles: string[];
  report: ResolvedKeyword[];
  degraded: boolean;
  /** Chaîne de thésaurus utilisée pour ce domaine */
  route: ThesaurusId[];
}

export interface ResolveOptions {
  /** Domaine du mémoire : détermine le thésaurus interrogé en priorité */
  domaineId?: string;
  selection?: KeywordSelection;
}

export interface ResolutionResult {
  report: ResolvedKeyword[];
  route: ThesaurusId[];
  domaineNom: string | null;
}

/**
 * Mots-clés auto-générés : 6 au total, TOUS préférentiellement des descripteurs.
 * (minDescripteurs = maxTotal : les mots libres ne servent que de repli s'il manque des descripteurs.)
 */
export const AUTO_KEYWORDS_SELECTION: KeywordSelection = { maxTotal: 6, minDescripteurs: 6 };

@Injectable()
export class ThesaurusKeywordService {
  private readonly logger = new Logger(ThesaurusKeywordService.name);
  /** Les domaines sont quasi statiques : évite une requête BD par soumission */
  private readonly domaineNomCache = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: ThesaurusRoutingService,
  ) {}

  /** Mots-clés saisis par l'utilisateur : résolution + persistance (descripteur si trouvé, sinon mot libre). */
  async resolveAndUpsert(rawKeywords: string[], options: ResolveOptions = {}): Promise<KeywordAssociation> {
    const { report, route } = await this.resolve(rawKeywords, options);
    return this.persist(report, route);
  }

  /**
   * Étape 1 — route vers le(s) thésaurus du domaine et mappe chaque mot brut vers un descripteur (appels HTTP).
   * Ne persiste rien. Ne lance pas d'erreur si une API est KO : le mot reste « libre ».
   */
  async resolve(rawKeywords: string[], options: ResolveOptions = {}): Promise<ResolutionResult> {
    const domaineNom = await this.getDomaineNom(options.domaineId);
    const route = this.routing.getRoute(domaineNom);
    if (rawKeywords.length === 0) return { report: [], route, domaineNom };

    const lookups = await this.routing.resolveKeywords(rawKeywords, domaineNom);
    const deduped = this.dedupe(lookups.map((l) => this.toResolved(l)));
    const report = options.selection ? this.select(deduped, options.selection) : deduped;
    return { report, route, domaineNom };
  }

  /** Étape 2 — upsert dans mots_cles ; l'appelant relie ensuite `motCleIds` au mémoire (pivot MemoireMotCle). */
  async persist(report: ResolvedKeyword[], route: ThesaurusId[]): Promise<KeywordAssociation> {
    const rows = new Map<string, MotCle>(); // dédoublonnage par id (deux mots bruts → même descripteur)
    for (const kw of report) {
      const row =
        kw.descripteurUri && kw.thesaurus
          ? await this.upsertDescripteur(kw.libelle, kw.thesaurus, kw.descripteurUri)
          : await this.upsertLibre(kw.libelle);
      rows.set(row.id, row);
    }

    const nbDegrades = report.filter((k) => k.status === 'libre_degrade').length;
    if (nbDegrades > 0) {
      this.logger.warn(
        `Mode dégradé thésaurus [${route.join(' → ')}] : ${nbDegrades}/${report.length} mot(s)-clé(s) enregistré(s) sans descripteur`,
      );
    }

    return {
      motCleIds: [...rows.keys()],
      libelles: [...rows.values()].map((r) => r.libelle),
      report,
      degraded: nbDegrades > 0,
      route,
    };
  }

  async getDomaineNom(domaineId?: string): Promise<string | null> {
    if (!domaineId) return null;
    const cached = this.domaineNomCache.get(domaineId);
    if (cached) return cached;

    const domaine = await this.prisma.domaine.findUnique({ where: { id: domaineId }, select: { nom: true } });
    if (domaine) this.domaineNomCache.set(domaineId, domaine.nom);
    return domaine?.nom ?? null;
  }

  /* ───────────────────────── Sélection / résolution ───────────────────────── */

  /* Descripteurs en priorité (jusqu'à minDescripteurs), puis mots libres ; complète jusqu'à maxTotal avec le reste */
  private select(items: ResolvedKeyword[], { maxTotal, minDescripteurs }: KeywordSelection): ResolvedKeyword[] {
    const descripteurs = items.filter((i) => i.status === 'descripteur');
    const libres = items.filter((i) => i.status !== 'descripteur');
    const nbLibres = maxTotal - minDescripteurs;

    const picked = [...descripteurs.slice(0, minDescripteurs), ...libres.slice(0, nbLibres)];
    for (const it of [...descripteurs.slice(minDescripteurs), ...libres.slice(nbLibres)]) {
      if (picked.length >= maxTotal) break;
      picked.push(it);
    }

    const nbDesc = picked.filter((i) => i.status === 'descripteur').length;
    this.logger.log(`Sélection : ${nbDesc}/${picked.length} descripteurs (${items.length} candidats)`);
    return picked;
  }

  private toResolved(lookup: ThesaurusLookup): ResolvedKeyword {
    switch (lookup.status) {
      case 'matched':
        return {
          raw: lookup.term,
          libelle: lookup.descriptor.prefLabel,
          thesaurus: lookup.descriptor.thesaurus,
          descripteurUri: lookup.descriptor.uri,
          status: 'descripteur',
        };
      case 'not_found':
        return { raw: lookup.term, libelle: lookup.term, thesaurus: null, descripteurUri: null, status: 'libre_non_trouve' };
      case 'unavailable':
        return { raw: lookup.term, libelle: lookup.term, thesaurus: null, descripteurUri: null, status: 'libre_degrade' };
    }
  }

  /** Un descripteur = une entrée ; un mot libre identique (casse près) à un descripteur trouvé est écarté. */
  private dedupe(items: ResolvedKeyword[]): ResolvedKeyword[] {
    const descLabels = new Set(items.filter((i) => i.descripteurUri).map((i) => i.libelle.toLowerCase()));
    const seen = new Set<string>();
    const out: ResolvedKeyword[] = [];

    for (const it of items) {
      const lower = it.libelle.toLowerCase();
      if (!it.descripteurUri && descLabels.has(lower)) continue;
      const key = it.descripteurUri ?? `libre:${lower}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  }

  /* ───────────────────────── Persistance ───────────────────────── */

  /**
   * Descripteur de thésaurus (`libelle` reste unique en BD) :
   *  - déjà connu par son URI → réutilisé ;
   *  - un mot de même libellé existe déjà : libre → « promu » (URI + thésaurus) ; déjà rattaché à un autre
   *    descripteur → réutilisé tel quel (le premier descripteur résolu gagne) ;
   *  - sinon création.
   */
  private async upsertDescripteur(libelle: string, thesaurus: ThesaurusId, descripteurUri: string): Promise<MotCle> {
    const byUri = await this.prisma.motCle.findUnique({ where: { descripteurUri } });
    if (byUri) return byUri;

    try {
      const sameLabel = await this.findByLibelle(libelle);
      if (sameLabel) {
        if (sameLabel.descripteurUri) return sameLabel;
        return await this.prisma.motCle.update({
          where: { id: sameLabel.id },
          data: { libelle, descripteurUri, thesaurus },
        });
      }
      return await this.prisma.motCle.create({ data: { libelle, descripteurUri, thesaurus } });
    } catch (e) {
      // Soumission concurrente : la ligne vient d'être créée entre notre lecture et notre écriture
      if (this.isUniqueViolation(e)) {
        const existing =
          (await this.prisma.motCle.findUnique({ where: { descripteurUri } })) ?? (await this.findByLibelle(libelle));
        if (existing) return existing;
      }
      throw e;
    }
  }

  /** Mot-clé libre : réutilise toute ligne de même libellé (même rattachée à un thésaurus), sinon crée. */
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