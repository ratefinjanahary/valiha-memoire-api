import { Injectable, Logger } from '@nestjs/common';
import { GoogleAiService } from '../search/google-ai.service.js';
import { THESAURUS_DISPLAY_NAMES } from '../thesaurus/thesaurus.config.js';
import { normalize, toSingular } from '../thesaurus/thesaurus.matcher.js';
import type { DescriptorCandidate } from '../thesaurus/thesaurus.types.js';
import {
  AUTO_KEYWORDS_SELECTION,
  ThesaurusKeywordService,
  type KeywordAssociation,
  type ResolvedKeyword,
} from '../thesaurus/thesaurus-keyword.service.js';
import { ThesaurusRoutingService } from '../thesaurus/thesaurus-routing.service.js';

const TARGET = AUTO_KEYWORDS_SELECTION.maxTotal; // 6
const CANDIDATES_TOTAL = 12; // plus de candidats « génériques » = plus de chances de trouver un descripteur
const CANDIDATES_GENERIC = 8;
const MAX_POOL_TERMS = 12;
const MAX_POOL_LABELS = 150; // borne la taille du prompt de sélection

const STOPWORDS = new Set([
  'dans', 'pour', 'avec', 'sans', 'sous', 'entre', 'vers', 'chez', 'selon', 'dont', 'leur', 'leurs',
  'cette', 'cette', 'ainsi', 'plus', 'tres', 'aussi', 'etude', 'analyse', 'role', 'impact',
]);

/**
 * Mots-clés AUTOMATIQUES d'un mémoire : vise 6 descripteurs de thésaurus.
 *  1. l'IA propose des candidats formulés comme des descripteurs du thésaurus du domaine ;
 *  2. on les résout (routage domaine → thésaurus) ;
 *  3. s'il manque des descripteurs : réservoir de descripteurs réels (recherche par préfixe autour des termes
 *     non résolus et du titre), puis l'IA choisit DANS cette liste fermée (repli lexical si l'IA échoue) ;
 *  4. dernier repli : mots libres (API KO, thésaurus sans terme proche) — jamais bloquant.
 */
@Injectable()
export class AutoKeywordsService {
  private readonly logger = new Logger(AutoKeywordsService.name);

  constructor(
    private readonly ai: GoogleAiService,
    private readonly keywords: ThesaurusKeywordService,
    private readonly routing: ThesaurusRoutingService,
  ) {}

  async generateAndUpsert(titre: string, resume: string, domaineId?: string): Promise<KeywordAssociation> {
    const domaineNom = await this.keywords.getDomaineNom(domaineId);
    const route = this.routing.getRoute(domaineNom);
    const primary = route[0];

    /* 1 — candidats IA */
    const raw = await this.ai.extractKeywords(titre, resume, {
      total: CANDIDATES_TOTAL,
      generic: CANDIDATES_GENERIC,
      thesaurusName: primary ? THESAURUS_DISPLAY_NAMES[primary] : undefined,
    });
    const candidates = this.cleanCandidates(raw);

    /* 2 — résolution (sans sélection : on garde tout pour pouvoir choisir et diagnostiquer) */
    const { report: resolved } = await this.keywords.resolve(candidates, { domaineId });
    const direct = resolved.filter((k) => k.status === 'descripteur').slice(0, TARGET);

    /* 3 — complétion par liste fermée */
    const completed = direct.length < TARGET ? await this.complete(titre, resume, domaineNom, resolved, direct) : [];

    /* 4 — repli : mots libres */
    const report: ResolvedKeyword[] = [...direct, ...completed];
    for (const libre of resolved.filter((k) => k.status !== 'descripteur')) {
      if (report.length >= TARGET) break;
      report.push(libre);
    }

    this.logDiagnostic(route, resolved, direct.length, completed.length, report);
    return this.keywords.persist(report, route);
  }

  /* ───────────────────────── Complétion ───────────────────────── */

  private async complete(
    titre: string,
    resume: string,
    domaineNom: string | null,
    resolved: ResolvedKeyword[],
    direct: ResolvedKeyword[],
  ): Promise<ResolvedKeyword[]> {
    const missing = TARGET - direct.length;
    const takenUris = new Set(direct.map((k) => k.descripteurUri));
    const takenLabels = new Set(direct.map((k) => normalize(k.libelle)));

    const unmatched = resolved.filter((k) => k.status !== 'descripteur').map((k) => k.raw);
    const terms = this.poolTerms(unmatched, titre);
    if (terms.length === 0) return [];

    const pool = (await this.routing.searchCandidates(terms, domaineNom))
      .filter((c) => !takenUris.has(c.uri) && !takenLabels.has(normalize(c.prefLabel)))
      .slice(0, MAX_POOL_LABELS);
    if (pool.length === 0) return [];

    // Le LLM choisit dans la liste fermée ; on re-valide chaque libellé contre le réservoir
    const labels = await this.ai.selectDescriptors({
      titre,
      resume,
      pool: pool.map((c) => c.prefLabel),
      already: direct.map((k) => k.libelle),
      count: missing,
    });
    const byLabel = new Map(pool.map((c) => [normalize(c.prefLabel), c] as const));
    const chosen: DescriptorCandidate[] = [];
    for (const label of labels) {
      const c = byLabel.get(normalize(label));
      if (c && !chosen.includes(c)) chosen.push(c);
    }

    if (chosen.length < missing) {
      const rest = pool.filter((c) => !chosen.includes(c));
      chosen.push(...this.lexicalFallback(rest, `${titre} ${resume}`, missing - chosen.length));
    }

    return chosen.slice(0, missing).map(
      (c): ResolvedKeyword => ({
        raw: c.prefLabel,
        libelle: c.prefLabel,
        thesaurus: c.thesaurus,
        descripteurUri: c.uri,
        status: 'descripteur',
      }),
    );
  }

  /** Termes de recherche du réservoir : mots (au singulier) des termes non résolus, puis du titre. */
  private poolTerms(unmatched: string[], titre: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const source of [...unmatched, titre]) {
      for (const word of source.split(/[^\p{L}\p{N}']+/u)) {
        const norm = normalize(word);
        if (norm.length < 4 || STOPWORDS.has(norm) || seen.has(norm)) continue;
        seen.add(norm);
        out.push(toSingular(word));
        if (out.length >= MAX_POOL_TERMS) return out;
      }
    }
    return out;
  }

  /** Repli sans IA : descripteurs dont le libellé figure tel quel dans le titre/résumé, les plus longs d'abord. */
  private lexicalFallback(pool: DescriptorCandidate[], text: string, n: number): DescriptorCandidate[] {
    const haystack = ` ${normalize(text)} `;
    return pool
      .map((c) => ({ c, label: normalize(c.prefLabel) }))
      .filter(({ label }) => label.length > 0 && haystack.includes(` ${label} `))
      .sort((a, b) => b.label.length - a.label.length)
      .slice(0, n)
      .map(({ c }) => c);
  }

  /* ───────────────────────── Utilitaires ───────────────────────── */

  /** Sortie du LLM → candidats propres : NFC, 2–50 caractères, au moins une lettre, sans doublon (casse près). */
  private cleanCandidates(raw: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of raw) {
      const s = r.normalize('NFC').replace(/\s+/g, ' ').trim();
      if (s.length < 2 || s.length > 50 || !/\p{L}/u.test(s)) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  /** Une seule ligne de log : candidats IA ✓/✗, d'où viennent les 6 mots-clés. De quoi diagnostiquer sans deviner. */
  private logDiagnostic(
    route: string[],
    resolved: ResolvedKeyword[],
    nbDirect: number,
    nbCompleted: number,
    report: ResolvedKeyword[],
  ): void {
    const nbDesc = report.filter((k) => k.status === 'descripteur').length;
    const candidats = resolved
      .map((k) => (k.status === 'descripteur' ? `${k.raw} ✓ ${k.libelle}` : `${k.raw} ✗`))
      .join(' | ');
    const msg =
      `Mots-clés auto [${route.join('→')}] : ${nbDesc}/${TARGET} descripteurs ` +
      `(${nbDirect} directs + ${nbCompleted} complétés + ${report.length - nbDesc} libres) — candidats IA : ${candidats}`;
    if (nbDesc < TARGET) this.logger.warn(msg);
    else this.logger.log(msg);
  }
}