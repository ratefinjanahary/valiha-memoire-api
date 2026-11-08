/*
  Warnings:

  - You are about to drop the column `is_unesco` on the `mots_cles` table. All the data in the column will be lost.
  - You are about to drop the column `unesco_uri` on the `mots_cles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[descripteur_uri]` on the table `mots_cles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Thesaurus" AS ENUM ('UNESCO', 'EUROVOC', 'RAMEAU', 'AGROVOC', 'MESH', 'GETTY_AAT');

-- DropIndex
DROP INDEX "mots_cles_is_unesco_idx";

-- DropIndex
DROP INDEX "mots_cles_unesco_uri_key";

-- AlterTable
ALTER TABLE "mots_cles" DROP COLUMN "is_unesco",
DROP COLUMN "unesco_uri",
ADD COLUMN     "descripteur_uri" TEXT,
ADD COLUMN     "thesaurus" "Thesaurus";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_changed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "mots_cles_descripteur_uri_key" ON "mots_cles"("descripteur_uri");

-- CreateIndex
CREATE INDEX "mots_cles_thesaurus_idx" ON "mots_cles"("thesaurus");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
