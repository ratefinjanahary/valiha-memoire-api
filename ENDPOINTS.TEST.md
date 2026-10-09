# 🚀 Documentation de Test API - Thunder Client (Plan Gratuit)

Voici la documentation complète des endpoints de l'API `valiha-api`, adaptée pour les utilisateurs de la version gratuite de **Thunder Client** (où les environnements et variables peuvent être limités ou inaccessibles).

---

## 🛠️ Plan d'attaque (Stratégie de test sans variables)

Pour tester efficacement cette API, voici la méthode de test manuelle recommandée :

### 0. Prérequis (feature Encadreurs & Graphe)
* Schéma appliqué : `npx prisma db push` (ou `npx prisma migrate dev`), puis redémarrer l'API.
* `EncadreurModule` ajouté aux `imports` de `AppModule` (sinon `/api/encadreurs` renvoie 404).
* ⚠️ **Désormais, soumettre un mémoire exige au moins un encadreur** : créez d'abord vos encadreurs (section 5 bis).
* Scénario complet bout en bout : voir la section **11** en bas du document.

### 1. Santé & Création de compte
* Testez la route principale `GET http://localhost:3000/` pour vérifier que l'API est en ligne.
* Utilisez l'endpoint d'inscription (`POST /api/auth/register`) pour vous créer un utilisateur avec le rôle `ADMIN` ou `DOCUMENTALISTE`.

### 2. Récupération manuelle du Token JWT
Puisque vous êtes sur le plan gratuit, vous ne pouvez pas toujours utiliser de variables d'environnement (`{{token}}`).
1. Connectez-vous avec `POST http://localhost:3000/api/auth/login`.
2. Dans la réponse JSON à droite, **copiez la valeur du token**.

### 3. Utilisation du Token pour les routes protégées
Pour chaque requête nécessitant d'être connecté (marquée "Protégée" ci-dessous) :
* Allez dans l'onglet **Auth** de la requête, puis sélectionnez **Bearer**.
* Collez manuellement votre token dans le champ **Token**.

---

## 📚 Liste des Endpoints et Requêtes

### 1. 🟢 Général / Santé
* **Vérification de l'API**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/`

---

### 2. 🔐 Authentification (`/api/auth`)

* **Inscription (Register)**
  * **Méthode** : `POST`
  * **URL** :     `http://localhost:3000/api/auth/register`
  * **Body (JSON)** :
    ```json
    {
      "email": "admin@valiha.com",
      "password": "password123",
      "nom": "Doe",
      "prenom": "John",
      "role": "ADMIN" 
    }
    ```
    * (Rôles possibles: PUBLIC, ETUDIANT, DOCUMENTALISTE, ADMIN)*
  * 📝 *Action auditée : `REGISTER`*

* **Connexion (Login)**
  * **Méthode** : `POST`
  * **URL** :     `http://localhost:3000/api/auth/login`
  * **Body (JSON)** :
    ```json
    {
      "email": "admin@valiha.com",
      "password": "password123"
    }
    ```
  * ⚠️ * N'oubliez pas de copier manuellement le token retourné pour la suite.*
  * 📝 *Action auditée : `LOGIN`*

* **Mon Profil**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/auth/profile`
  * **Auth** : Bearer Token (Coller le token copié)

---

### 3. 👥 Utilisateurs (`/api/users`)

* **Lister tous les utilisateurs (Admin uniquement)**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/users`
  * **Auth** : Bearer Token (Coller le token copié)

---

### 4. 🏫 Universités (`/api/universites`)

* **Lister les universités**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/universites`
  * 💡 * Utile pour récupérer l'UUID d'une université avant de soumettre un mémoire.*

* **Créer une université (Protégé)**
  * **Méthode** : `POST`
  * **URL** :     `http://localhost:3000/api/universites`
  * **Auth** : Bearer Token (Coller le token copié)
  * **Body (JSON)** :
    ```json
    {
      "nom": "Université d'Antananarivo",
      "sigle": "UA",
      "ville": "Antananarivo"
    }
    ```

---

### 5. 📁 Domaines (`/api/domaine`)

* **Lister les domaines**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/domaine`
  * 💡 * Utile pour récupérer l'UUID d'un domaine avant de soumettre un mémoire. *

* **Créer un domaine (Protégé)**
  * **Méthode** : `POST`
  * **URL** :     `http://localhost:3000/api/domaine`
  * **Auth** : Bearer Token (Coller le token copié)
  * **Body (JSON)** :
    ```json
    {
      "nom": "Informatique",
      "description": "Domaine de l'informatique et des sciences du numérique"
    }
    ```

---

### 5 bis. 🧑‍🏫 Encadreurs (`/api/encadreurs`)

* **Lister / rechercher les encadreurs** (alimente le ComboBox de soumission)
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/encadreurs`
  * **Auth** : Aucune par défaut (si vous avez ajouté un guard sur cette route, collez le Bearer Token)
  * **Query Parameters** (Optionnels) :
    * `q` : `rakoto jean` *(chaque mot doit matcher le nom, le prénom ou le titre, sans tenir compte de la casse ni de l'ordre)*
    * `page` : `1` *(défaut 1)*
    * `limit` : `10` *(défaut 10, max 50)*
  * **Exemples** :
    * `GET /api/encadreurs` → première page, 10 encadreurs triés par nom
    * `GET /api/encadreurs?q=rakoto&limit=5`
    * `GET /api/encadreurs?q=dr+jean&page=2`
  * 💡 *L'email n'est volontairement pas renvoyé. `nbMemoiresEncadres` / `nbMemoiresAuteur` servent à départager les homonymes dans le ComboBox.*
  * **Réponse** :
    ```json
    {
      "data": [
        {
          "id": "3f1c...-uuid",
          "nom": "Rakoto",
          "prenom": "Jean",
          "titre": "Dr",
          "nbMemoiresEncadres": 3,
          "nbMemoiresAuteur": 1
        }
      ],
      "meta": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
    }
    ```

* **Créer un encadreur**
  * **Méthode** : `POST`
  * **URL** :     `http://localhost:3000/api/encadreurs`
  * **Auth** : Bearer Token si vous avez protégé la route (le `TODO` guard dans le controller)
  * **Body (JSON)** :
    ```json
    {
      "nom": "Rakoto",
      "prenom": "Jean",
      "titre": "Dr",
      "email": "jean.rakoto@example.com"
    }
    ```
    * `titre` et `email` sont optionnels (une chaîne vide `""` est traitée comme absente).
  * **Réponse** : l'encadreur créé (`id`, `nom`, `prenom`, `titre`, `email`, `createdAt`). **Copiez l'`id`**, il sert pour la soumission d'un mémoire.
  * **Cas d'erreur à tester** :

    | Requête | Résultat attendu |
    |---|---|
    | `nom` de 1 caractère | `400` (« Le nom est requis ») |
    | `email` invalide | `400` (« Email invalide ») |
    | Même `email` envoyé deux fois (casse différente comprise) | `409` (« Un encadreur avec cet email existe déjà ») |

---

### 6. 🎓 Mémoires - Recherche & Actions (`/api/memoires`)

#### ✅ Feat - Recherche par mot-clé `any|all` (PUBLIC)

* **Recherche par mots-clés**
  * **Méthode** : `GET`
  * **URL** : `http://localhost:3000/api/memoires/search`
  * **Auth** : Optionnel (Bearer Token pour un rôle étendu)
  * **Query Parameters** (Optionnels) :
    * `q` : `intelligence artificielle`
    * `mode` : `any` *(ou `all` — défaut : `any`)*
    * `annee` : `2023`
    * `typeDiplome` : `MASTER` *(LICENCE, MASTER, DOCTORAT)*
    * `universiteId` : `(UUID)`
    * `domaineId` : `(UUID)`
    * `page` : `1` *(Défaut 1, fixé à 10 résultats par page)*
  * **Exemples** :
    * `GET /api/memoires/search?q=intelligence+artificielle&mode=any&page=2`
    * `GET /api/memoires/search?q=machine+learning&mode=all&annee=2023`
  * 💡 *`mode=any` → contient AU MOINS UN des mots | `mode=all` → contient TOUS les mots*
  * 🔐 *PUBLIC → VALIDE uniquement | ETUDIANT → VALIDE + ses propres | DOC/ADMIN → tout*
  * 📝 *Action auditée : `SEARCH`*
  * **Réponse** :
    ```json
    {
      "data": [...],
      "meta": {
        "total": 42,
        "page": 1,
        "limit": 10,
        "totalPages": 5
      }
    }
    ```

* **Recherche Sémantique (Vectorielle)**
  * **Méthode** : `POST`
  * **URL** : `http://localhost:3000/api/memoires/search-semantic`
  * **Body (JSON)** :
    ```json
    {
      "query": "Impact de l'IA sur l'éducation"
    }
    ```

* **Export BibTeX d'un mémoire**
  * **Méthode** : `GET`
  * **URL** : `http://localhost:3000/api/memoires/:id/export-bibtex` (Remplacez `:id` par un UUID valide dans l'URL)

* **Soumettre un mémoire (Protégé)**
  * **Méthode** : `POST`
  * **URL** : `http://localhost:3000/api/memoires/submit`
  * ⚠️ **Attention - Upload PDF** : Le plan gratuit de Thunder Client ne permet pas d'uploader des fichiers. Veuillez utiliser l'extension **Telegraph REST API Client** dans VS Code pour tester cet endpoint.
  * **Configuration dans Telegraph** :
    * **Auth** : Ajoutez manuellement un header `Authorization` avec la valeur `Bearer <VOTRE_TOKEN>` (ou utilisez le système d'authentification de Telegraph si configuré).
    * **Body** : Allez dans l'onglet **Body**, choisissez **Form Data** (ou `multipart/form-data`).
    * Ajoutez les champs (clés/valeurs) suivants :
      * `file` : * (Changez le type "Text" en "File" et uploadez un PDF) *
      * `titre` : `Développement d'une API`
      * `resume` : `Un super résumé...`
      * `anneeSoutenance` : `2024`
      * `typeDiplome` : `MASTER`
      * `auteurNom` : `Doe`
      * `auteurPrenom` : `Jane`
      * `auteurEmail` : `jane@example.com`
      * `universiteId` : `(UUID valide)`
      * `domaineId` : `(UUID valide)`
      * `encadreurIds` : `(UUID d'un encadreur)` — **obligatoire, 1 à 5**. Pour en mettre plusieurs, **ajoutez une ligne par encadreur avec la même clé `encadreurIds`**.
        * Alternatives acceptées si votre client ne gère pas les clés répétées : un seul champ avec du JSON (`["uuid1","uuid2"]`) ou une liste séparée par des virgules (`uuid1,uuid2`).
      * `auteurEncadreurId` : `(UUID d'un encadreur)` — **optionnel**. À renseigner si l'auteur du mémoire est lui-même un encadreur déjà enregistré (crée l'arête `auteur_de` dans le graphe). Laissez vide ou omettez sinon.
  * 📝 *Action auditée : `SUBMIT_MEMOIRE`*
  * **Cas d'erreur à tester** (tous en `400`, et **aucun PDF n'est uploadé** : la validation se fait avant) :

    | Requête | Message attendu |
    |---|---|
    | Pas de `encadreurIds` | « Au moins un encadreur est requis » |
    | `encadreurIds` = `abc` | « ID encadreur invalide » |
    | 6 UUID dans `encadreurIds` | « 5 encadreurs maximum » |
    | UUID valide mais inexistant | « Encadreur(s) introuvable(s) : ... » |
    | `auteurEncadreurId` identique à un des `encadreurIds` | « L'auteur d'un mémoire ne peut pas en être aussi l'encadreur » |
  * 💡 *Après soumission, le mémoire est `EN_ATTENTE_MODERATION` : il n'apparaît dans le graphe qu'après passage en `VALIDE` (section 7).*

---

#### Feat — Recommandation Jaccard (PUBLIC)

* **Mémoires similaires (Jaccard sur mots-clés)**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/memoires/:id/similaires`
  * **Auth** :     Aucune (endpoint public, retourne uniquement des VALIDE)
  * **Query Parameters** (Optionnels) :
    * `limit` : `5` *(max 20, défaut 5)*
  * **Exemple** :
    * `GET /api/memoires/550e8400-e29b-41d4-a716-446655440000/similaires?limit=10`
  * 💡 *L'indice de Jaccard est calculé sur les mots-clés communs : `|A ∩ B| / |A ∪ B|`*
  * **Réponse** :
    ```json
    [
      {
        "id": "...",
        "titre": "Titre du mémoire similaire",
        "jaccardScore": 0.666,
        "motsCles": [...],
        ...
      }
    ]
    ```

---

#### Feat — Popularité & Top (PUBLIC)

* **Popularité d'un mémoire**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/memoires/:id/popularite`
  * **Auth** :    Aucune (endpoint public, fonctionne uniquement sur les VALIDE)
  * **Exemple** :
    * `GET /api/memoires/550e8400-e29b-41d4-a716-446655440000/popularite`
  * **Réponse** :
    ```json
    {
      "memoireId": "550e8400-...",
      "titre": "Développement d'une API REST",
      "auteur": "Jane Doe",
      "nbConsultations": 127
    }
    ```

* **Top des mémoires les plus consultés**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/memoires/top`
  * **Auth** : Aucune (endpoint public, retourne uniquement des VALIDE)
  * **Query Parameters** (Optionnels) :
    * `limit` : `10` *(max 100, défaut 10)*
  * **Exemple** :
    *  `GET /api/memoires/top?limit=5`
  * **Réponse** :
    ```json
    [
      {
        "rang": 1,
        "id": "...",
        "titre": "...",
        "nbConsultations": 342,
        "universite": { "nom": "...", "sigle": "..." },
        ...
      }
    ]
    ```

---

### 7. 🛡️ Modération (`/api/moderation`)

* (Ces endpoints nécessitent le rôle `DOCUMENTALISTE` ou `ADMIN`) *

* **Lister les mémoires en attente**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/moderation/pending`
  * **Auth** : Bearer Token (Coller le token copié)
  * **Query Parameters** (Optionnels) :
    * `page` : `1` *(Défaut 1, fixé à 10 résultats par page)*

* **Mettre à jour le statut d'un mémoire**
  * **Méthode** : `PATCH`
  * **URL** :     `http://localhost:3000/api/moderation/:id/status` (Remplacez `:id` dans l'URL)
  * **Auth** : Bearer Token (Coller le token copié)
  * **Body (JSON)** :
    ```json
    {
      "statut": "VALIDE" 
    }
    ```
    * (Valeurs: BROUILLON, EN_ATTENTE_MODERATION, VALIDE, REJETTE) *
    * Note: Si rejeté, ajoutez `"motifRejet": "Raison du rejet"`.*
  * 📝 *Action auditée : `VALIDATE_MEMOIRE` ou `REJECT_MEMOIRE`*

---

### 8. 🔑 Mots-clés (`/api/mot-cles`)

#### Feat — Trending mots-clés (cache TTL 5 min)

* **Mots-clés tendance**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/mot-cles/trending`
  * **Auth** :     Aucune (endpoint public)
  * **Query Parameters** (Optionnels) :
    *             `limit` : `10` *(max 50, défaut 10)*
  * **Exemple** :
    *             `GET /api/mot-cles/trending?limit=20`
  * 💡 *Résultats mis en cache pendant **5 minutes** pour éviter des requêtes répétées sur la BDD.*
  * **Réponse** :
    ```json
    [
      { "motCleId": "...", "libelle": "intelligence artificielle", "count": 24 },
      { "motCleId": "...", "libelle": "machine learning", "count": 18 },
      { "motCleId": "...", "libelle": "réseau de neurones", "count": 12 }
    ]
    ```

---

### 9. 📊 Analytics & Graphes

* **Graphe de relations**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/graph/data`
  * **Auth** : Aucune
  * 💡 *Ne renvoie que les mémoires `VALIDE` et les noeuds (universités, domaines, encadreurs) reliés à au moins un d'eux : pas de noeud orphelin.*
  * **Types de noeuds** : `universite`, `domaine`, `encadreur`, `memoire` (ids préfixés `univ_`, `dom_`, `enc_`, `mem_`).
  * **Types d'arêtes** :

    | Type | Sens | Signification |
    |---|---|---|
    | `appartient_a` | mémoire → université | où le mémoire a été soutenu |
    | `traite_de` | mémoire → domaine | domaine du mémoire |
    | `encadre_par` | mémoire → encadreur | encadrement |
    | `auteur_de` | encadreur → mémoire | l'encadreur est l'auteur de ce mémoire (son propre mémoire) |
  * **Réponse (extrait)** :
    ```json
    {
      "nodes": [
        { "id": "univ_<uuid>", "label": "UA", "type": "universite", "data": { "refId": "<uuid>", "nom": "Université d'Antananarivo" } },
        { "id": "dom_<uuid>", "label": "Informatique", "type": "domaine", "data": { "refId": "<uuid>" } },
        { "id": "enc_<uuid>", "label": "Rakoto Jean", "type": "encadreur", "data": { "refId": "<uuid>", "titre": "Dr" } },
        { "id": "mem_<uuid>", "label": "Développement d'une API", "type": "memoire",
          "data": { "refId": "<uuid>", "anneeSoutenance": 2024, "typeDiplome": "MASTER", "auteur": "Jane Doe" } }
      ],
      "edges": [
        { "id": "encadre_par:mem_<uuid>:enc_<uuid>", "source": "mem_<uuid>", "target": "enc_<uuid>", "type": "encadre_par" },
        { "id": "auteur_de:enc_<uuid>:mem_<uuid>", "source": "enc_<uuid>", "target": "mem_<uuid>", "type": "auteur_de" }
      ]
    }
    ```
  * **À vérifier** :
    * chaque `edges[].id` est unique ;
    * chaque `source` et `target` correspond à un `nodes[].id` existant ;
    * un mémoire encore `EN_ATTENTE_MODERATION` ou `REJETTE` n'apparaît pas ;
    * un mémoire déjà en base **sans** liaison encadreur apparaît quand même, mais sans arête `encadre_par` (liaison à faire à la main dans Prisma Studio, table `memoire_encadreurs`).

* **Récupérer les KPIs**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/analytics/kpis`

* **Récupérer les données de graphiques (Charts)**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/analytics/charts`

---

### 10. 📜 Audit (`/api/audit`)

* **Lister les logs d'audit (Admin uniquement)**
  * **Méthode** : `GET`
  * **URL** :     `http://localhost:3000/api/audit`
  * **Auth** : Bearer Token (Coller le token copié, rôle ADMIN)
  * **Query Parameters** (Optionnels) :
    * `page` : `1` *(Défaut 1)*
  * **Exemple** :
    * `GET /api/audit?page=1`

---

### 11. 🧪 Scénario complet : encadreurs + graphe

Objectif : obtenir une petite lignée « A encadre M1, A est auteur de M2, B encadre M2 ».
Prérequis : être connecté, avoir au moins une université et un domaine (copiez leurs UUID via `GET /api/universites` et `GET /api/domaine`).

1. **Créer l'encadreur A** : `POST /api/encadreurs` avec `{ "nom": "Rakoto", "prenom": "Jean", "titre": "Dr" }` → notez `idA`.
2. **Créer l'encadreur B** : `POST /api/encadreurs` avec `{ "nom": "Rasoa", "prenom": "Marie", "titre": "Pr" }` → notez `idB`.
3. **Tester le ComboBox** : `GET /api/encadreurs?q=rak` doit renvoyer A seul ; `GET /api/encadreurs?limit=1` doit renvoyer 1 résultat avec `totalPages` = 2.
4. **Soumettre M1** (Telegraph, `multipart/form-data`) avec `encadreurIds` = `idA` et sans `auteurEncadreurId` → notez `idM1`.
5. **Soumettre M2** avec `encadreurIds` = `idB` et `auteurEncadreurId` = `idA` → notez `idM2`.
6. **Valider M1 et M2** : `PATCH /api/moderation/:id/status` avec `{ "statut": "VALIDE" }` (token DOCUMENTALISTE/ADMIN), une fois par mémoire.
7. **Appeler le graphe** : `GET /api/graph/data`. Résultat attendu :
   * 2 noeuds `encadreur`, 2 noeuds `memoire`, et leurs université/domaine ;
   * `encadre_par` : `mem_idM1 → enc_idA` et `mem_idM2 → enc_idB` ;
   * `auteur_de` : `enc_idA → mem_idM2`.
8. **Vérifier le filtre** : soumettez M3 sans le valider, rappelez le graphe : M3 ne doit pas y figurer.
9. **Vérifier la liste enrichie** : `GET /api/encadreurs?q=rakoto` doit afficher `nbMemoiresEncadres: 1` et `nbMemoiresAuteur: 1` pour A.

---

## 🗺️ Récapitulatif des nouvelles features

| Feature                  | Endpoint                       | Méthode | Rôle min. | Cache |
|--------------------------|--------------------------------|---------|-----------|-------|
| **1** Recherche any\|all | `/api/memoires/search`         | GET     | PUBLIC    | —     |
| **2** Trending mots-clés | `/api/mot-cles/trending`       | GET     | PUBLIC    | ✅ 5 min |
| **4** Jaccard similaires | `/api/memoires/:id/similaires` | GET     | PUBLIC    | —     |
| **5** Liste des audits   | `/api/audit`                   | GET     | ADMIN     | —     |
| **7** Popularité mémoire | `/api/memoires/:id/popularite` | GET     | PUBLIC    | —     |
| **7** Top consultés      | `/api/memoires/top`            | GET     | PUBLIC    | —     |
| **8** Liste encadreurs   | `/api/encadreurs`              | GET     | PUBLIC*   | —     |
| **8** Créer un encadreur | `/api/encadreurs`              | POST    | selon guard* | —  |
| **9** Graphe de relations| `/api/graph/data`              | GET     | PUBLIC    | —     |

\* Aucun guard n'est posé par défaut sur `/api/encadreurs` (voir le `TODO` dans `encadreur.controller.ts`).

## 🔒 Actions auditées automatiquement

Chaque action critique est enregistrée dans la table `audit_logs` :

| Action             | Déclencheur                     |
|--------------------|---------------------------------|
| `REGISTER`         | `POST /api/auth/register`       |
| `LOGIN`            | `POST /api/auth/login`          |
| `SUBMIT_MEMOIRE`   | `POST /api/memoires/submit`     |
| `VALIDATE_MEMOIRE` | `PATCH /api/moderation/:id/status` → VALIDE  |
| `REJECT_MEMOIRE`   | `PATCH /api/moderation/:id/status` → REJETTE |
| `SEARCH`           | `GET /api/memoires/search`            |
| `SEARCH_SEMANTIC`  | `POST /api/memoires/search-semantic`  |
| `SIMILAIRES`       | `GET /api/memoires/:id/similaires`    |
| `POPULARITE`       | `GET /api/memoires/:id/popularite`    |
| `SEARCH_SEMANTIC`  | `POST /api/memoires/search-semantic`  |