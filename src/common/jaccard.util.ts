/**
 * Calcule le coefficient de similarité de Jaccard entre deux ensembles de chaînes.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 *
 * @returns un nombre entre 0 (aucune similarité) et 1 (identiques)
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const elem of setA) {
    if (setB.has(elem)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
