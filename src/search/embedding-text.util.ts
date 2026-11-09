export function buildEmbeddingText(m: { titre: string; resume: string; motsCles?: string[] }) {
  const kw = m.motsCles?.length ? `\nMots-clés : ${m.motsCles.join(', ')}` : '';
  return `${m.titre}\n${m.resume}${kw}`;
}