// scripts/reindex-embeddings.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { GoogleAiService } from '../src/search/google-ai.service.js';
import { buildEmbeddingText } from '../src/search/embedding-text.util.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const ai = app.get(GoogleAiService);

  const memoires = await prisma.memoire.findMany({
    select: {
      id: true, titre: true, resume: true,
      motsCles: { select: { motCle: { select: { libelle: true } } } },
    },
  });

  for (const [i, m] of memoires.entries()) {
    const text = buildEmbeddingText({
      titre: m.titre,
      resume: m.resume,
      motsCles: m.motsCles.map((x) => x.motCle.libelle),
    });
    const emb = await ai.generateEmbedding(text, 'RETRIEVAL_DOCUMENT');
    await prisma.$executeRawUnsafe(
      `UPDATE memoires SET embedding = $1::vector WHERE id = $2`,
      `[${emb.join(',')}]`,
      m.id,
    );
    console.log(`${i + 1}/${memoires.length} ${m.titre}`);
    await sleep(700); // évite de dépasser le quota gratuit
  }
  await app.close();
}
main();