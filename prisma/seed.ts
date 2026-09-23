import { PrismaClient, Role, StatutMemoire, TypeDiplome } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Users (5)
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@valiha.mg' },
    update: {},
    create: { email: 'admin@valiha.mg', passwordHash, nom: 'Admin', prenom: 'Super', role: Role.ADMIN },
  });

  const doc = await prisma.user.upsert({
    where: { email: 'doc@valiha.mg' },
    update: {},
    create: { email: 'doc@valiha.mg', passwordHash, nom: 'Doc', prenom: 'Umentaliste', role: Role.DOCUMENTALISTE },
  });

  const etudiant1 = await prisma.user.upsert({
    where: { email: 'etu1@valiha.mg' },
    update: {},
    create: { email: 'etu1@valiha.mg', passwordHash, nom: 'Randria', prenom: 'Jean', role: Role.ETUDIANT },
  });

  const etudiant2 = await prisma.user.upsert({
    where: { email: 'etu2@valiha.mg' },
    update: {},
    create: { email: 'etu2@valiha.mg', passwordHash, nom: 'Rasoa', prenom: 'Marie', role: Role.ETUDIANT },
  });

  const publicUser = await prisma.user.upsert({
    where: { email: 'public@valiha.mg' },
    update: {},
    create: { email: 'public@valiha.mg', passwordHash, nom: 'Rakoto', prenom: 'Paul', role: Role.PUBLIC },
  });

  // 2. Universités (3)
  const univTana = await prisma.universite.upsert({
    where: { nom: 'Université d\'Antananarivo' },
    update: {},
    create: { nom: 'Université d\'Antananarivo', sigle: 'UA', ville: 'Antananarivo' },
  });
  const univFianar = await prisma.universite.upsert({
    where: { nom: 'Université de Fianarantsoa' },
    update: {},
    create: { nom: 'Université de Fianarantsoa', sigle: 'UF', ville: 'Fianarantsoa' },
  });
  const emit = await prisma.universite.upsert({
    where: { nom: 'EMIT Fianarantsoa' },
    update: {},
    create: { nom: 'EMIT Fianarantsoa', sigle: 'EMIT', ville: 'Fianarantsoa' },
  });

  // 3. Domaines
  const domInfo = await prisma.domaine.upsert({
    where: { nom: 'Informatique' },
    update: {},
    create: { nom: 'Informatique', description: 'Sciences du numérique' },
  });
  const domAgri = await prisma.domaine.upsert({
    where: { nom: 'Agronomie' },
    update: {},
    create: { nom: 'Agronomie', description: 'Sciences agronomiques' },
  });
  const domEco = await prisma.domaine.upsert({
    where: { nom: 'Économie' },
    update: {},
    create: { nom: 'Économie', description: 'Sciences économiques et gestion' },
  });

  // 4. Encadreurs
  const enc1 = await prisma.encadreur.create({
    data: { nom: 'Andriamalala', prenom: 'Hery', titre: 'Professeur', email: 'hery@univ.mg' },
  });
  const enc2 = await prisma.encadreur.create({
    data: { nom: 'Rakotonirina', prenom: 'Fanja', titre: 'Dr', email: 'fanja@univ.mg' },
  });

  // 5. Mots Clés
  const kwIA = await prisma.motCle.upsert({ where: { libelle: 'IA' }, update: {}, create: { libelle: 'IA' } });
  const kwWeb = await prisma.motCle.upsert({ where: { libelle: 'Web' }, update: {}, create: { libelle: 'Web' } });
  const kwAgri = await prisma.motCle.upsert({ where: { libelle: 'Agriculture' }, update: {}, create: { libelle: 'Agriculture' } });

  // 6. Mémoires
  // Fonction utilitaire pour insérer 1 mémoire
  const createMemoire = async (titre: string, resume: string, statut: StatutMemoire, user: any, univ: any, dom: any, diplome: TypeDiplome) => {
    return prisma.memoire.create({
      data: {
        titre,
        resume,
        anneeSoutenance: 2023,
        statut,
        typeDiplome: diplome,
        pdfUrl: 'uploads/dummy.pdf',
        auteurNom: user.nom,
        auteurPrenom: user.prenom,
        soumisParId: user.id,
        universiteId: univ.id,
        domaineId: dom.id,
      },
    });
  };

  const m1 = await createMemoire('Application Web pour la gestion agricole', 'Ce mémoire traite de la création...', StatutMemoire.VALIDE, etudiant1, emit, domInfo, TypeDiplome.LICENCE);
  const m2 = await createMemoire('Impact de l\'IA sur l\'économie locale', 'Une étude approfondie...', StatutMemoire.EN_ATTENTE_MODERATION, etudiant2, univTana, domEco, TypeDiplome.MASTER);
  const m3 = await createMemoire('Modélisation des rendements rizicoles', 'L\'agriculture est...', StatutMemoire.VALIDE, etudiant1, univFianar, domAgri, TypeDiplome.DOCTORAT);
  
  // Relations Encadreurs & Mots clés
  await prisma.memoireEncadreur.create({ data: { memoireId: m1.id, encadreurId: enc1.id, role: 'Directeur' } });
  await prisma.memoireMotCle.create({ data: { memoireId: m1.id, motCleId: kwWeb.id } });
  await prisma.memoireMotCle.create({ data: { memoireId: m1.id, motCleId: kwAgri.id } });

  console.log('Seed terminé !');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
