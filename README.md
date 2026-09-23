# VALIHA-Memoire Backend

Backend NestJS pour la Plateforme Nationale de Valorisation et d'Exploration Visualisée du Patrimoine Académique de Madagascar (VALIHA-Memoire).

## Prérequis
- Node.js (v18+)
- PostgreSQL (avec l'extension `pgvector` activée)
- Clé API Google Gemini (pour `text-embedding-004`)

## Installation

```bash
# Installer les dépendances
npm install
```

## Configuration
Copiez le fichier `.env.example` vers `.env` et modifiez les variables :
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/valiha_memoire?schema=public"
JWT_SECRET="votre_secret_jwt"
GEMINI_API_KEY="votre_cle_api_google_gemini"
```

## Base de données
Assurez-vous que l'extension `pgvector` est activée dans votre base PostgreSQL.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Générez le client Prisma et appliquez les migrations :
```bash
npx prisma generate
npx prisma db push
```

## Seed de la base de données
Pour peupler la base avec des données factices (Universités, Domaines, Encadreurs, Utilisateurs, Mémoires) :
```bash
npm run seed
# ou
npx prisma db seed
```

### Credentials générés par le seed :
Tous les mots de passe sont : **`password123`**

- **Admin** : `admin@valiha.mg` (Rôle : ADMIN)
- **Documentaliste** : `doc@valiha.mg` (Rôle : DOCUMENTALISTE)
- **Étudiant 1** : `etu1@valiha.mg` (Rôle : ETUDIANT)
- **Étudiant 2** : `etu2@valiha.mg` (Rôle : ETUDIANT)
- **Public** : `public@valiha.mg` (Rôle : PUBLIC)

## Lancement
```bash
# Développement
npm run start:dev

# Production
npm run build
npm run start:prod
```
