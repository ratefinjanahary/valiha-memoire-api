import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { universites } from './universites.data';
import { domaines } from './domaines.data';
import { encadreurs } from './encadreurs.data';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Début du peuplement des universités sur Neon...`);
  
  for (const u of universites) {
    await prisma.universite.upsert({
      where: { nom: u.nom },
      update: {},
      create: u,
    });
  }

  console.log(`Début du peuplement des domaines d'études...`);
  for (const d of domaines) {
    await prisma.domaine.upsert({
      where: { nom: d.nom },
      update: {},
      create: d,
    });
  }

  console.log(`Début du peuplement des encadreurs...`);
  for (const e of encadreurs) {
    await prisma.encadreur.create({
      data: e,
    });
  }
  
  console.log(`Peuplement terminé avec succès ! 🎉`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });