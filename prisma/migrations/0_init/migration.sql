-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PUBLIC', 'ETUDIANT', 'DOCUMENTALISTE', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatutMemoire" AS ENUM ('BROUILLON', 'EN_ATTENTE_MODERATION', 'VALIDE', 'REJETTE');

-- CreateEnum
CREATE TYPE "TypeDiplome" AS ENUM ('LICENCE', 'MASTER', 'DOCTORAT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PUBLIC',
    "is_actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universites" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "sigle" TEXT,
    "ville" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "universites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domaines" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domaines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encadreurs" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "titre" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encadreurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mots_cles" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "unesco_uri" TEXT,
    "is_unesco" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mots_cles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memoires" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "resume" TEXT NOT NULL,
    "annee_soutenance" INTEGER NOT NULL,
    "type_diplome" "TypeDiplome" NOT NULL DEFAULT 'LICENCE',
    "statut" "StatutMemoire" NOT NULL DEFAULT 'EN_ATTENTE_MODERATION',
    "motif_rejet" TEXT,
    "pdf_url" TEXT,
    "pdf_path_local" TEXT,
    "nb_pages" INTEGER,
    "taille_fichier" INTEGER,
    "auteur_nom" TEXT NOT NULL,
    "auteur_prenom" TEXT NOT NULL,
    "auteur_email" TEXT,
    "embedding" vector(3072),
    "soumis_par_id" TEXT NOT NULL,
    "universite_id" TEXT NOT NULL,
    "domaine_id" TEXT NOT NULL,
    "auteur_encadreur_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memoires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memoire_encadreurs" (
    "memoire_id" TEXT NOT NULL,
    "encadreur_id" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "memoire_encadreurs_pkey" PRIMARY KEY ("memoire_id","encadreur_id")
);

-- CreateTable
CREATE TABLE "memoire_mots_cles" (
    "memoire_id" TEXT NOT NULL,
    "mot_cle_id" TEXT NOT NULL,

    CONSTRAINT "memoire_mots_cles_pkey" PRIMARY KEY ("memoire_id","mot_cle_id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "memoire_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "consulted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "universites_nom_key" ON "universites"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "domaines_nom_key" ON "domaines"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "mots_cles_libelle_key" ON "mots_cles"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "mots_cles_unesco_uri_key" ON "mots_cles"("unesco_uri");

-- CreateIndex
CREATE INDEX "mots_cles_is_unesco_idx" ON "mots_cles"("is_unesco");

-- CreateIndex
CREATE INDEX "memoires_auteur_encadreur_id_idx" ON "memoires"("auteur_encadreur_id");

-- CreateIndex
CREATE INDEX "memoire_encadreurs_encadreur_id_idx" ON "memoire_encadreurs"("encadreur_id");

-- AddForeignKey
ALTER TABLE "memoires" ADD CONSTRAINT "memoires_soumis_par_id_fkey" FOREIGN KEY ("soumis_par_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memoires" ADD CONSTRAINT "memoires_universite_id_fkey" FOREIGN KEY ("universite_id") REFERENCES "universites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memoires" ADD CONSTRAINT "memoires_domaine_id_fkey" FOREIGN KEY ("domaine_id") REFERENCES "domaines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memoires" ADD CONSTRAINT "memoires_auteur_encadreur_id_fkey" FOREIGN KEY ("auteur_encadreur_id") REFERENCES "encadreurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memoire_encadreurs" ADD CONSTRAINT "memoire_encadreurs_memoire_id_fkey" FOREIGN KEY ("memoire_id") REFERENCES "memoires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memoire_encadreurs" ADD CONSTRAINT "memoire_encadreurs_encadreur_id_fkey" FOREIGN KEY ("encadreur_id") REFERENCES "encadreurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memoire_mots_cles" ADD CONSTRAINT "memoire_mots_cles_memoire_id_fkey" FOREIGN KEY ("memoire_id") REFERENCES "memoires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memoire_mots_cles" ADD CONSTRAINT "memoire_mots_cles_mot_cle_id_fkey" FOREIGN KEY ("mot_cle_id") REFERENCES "mots_cles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_memoire_id_fkey" FOREIGN KEY ("memoire_id") REFERENCES "memoires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
