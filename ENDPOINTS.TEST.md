# 🚀 Documentation de Test API - Thunder Client (Plan Gratuit)

Voici la documentation complète des endpoints de l'API `valiha-api`, adaptée pour les utilisateurs de la version gratuite de **Thunder Client** (où les environnements et variables peuvent être limités ou inaccessibles).

---

## 🛠️ Plan d'attaque (Stratégie de test sans variables)

Pour tester efficacement cette API, voici la méthode de test manuelle recommandée :

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
  * 📝 *Action auditée : `SUBMIT_MEMOIRE`*

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

## 🗺️ Récapitulatif des nouvelles features

| Feature                  | Endpoint                       | Méthode | Rôle min. | Cache |
|--------------------------|--------------------------------|---------|-----------|-------|
| **1** Recherche any\|all | `/api/memoires/search`         | GET     | PUBLIC    | —     |
| **2** Trending mots-clés | `/api/mot-cles/trending`       | GET     | PUBLIC    | ✅ 5 min |
| **4** Jaccard similaires | `/api/memoires/:id/similaires` | GET     | PUBLIC    | —     |
| **5** Liste des audits   | `/api/audit`                   | GET     | ADMIN     | —     |
| **7** Popularité mémoire | `/api/memoires/:id/popularite` | GET     | PUBLIC    | —     |
| **7** Top consultés      | `/api/memoires/top`            | GET     | PUBLIC    | —     |

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
