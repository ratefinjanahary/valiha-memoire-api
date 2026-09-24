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
  * **URL** : `http://localhost:3000/`

---

### 2. 🔐 Authentification (`/api/auth`)

* **Inscription (Register)**
  * **Méthode** : `POST`
  * **URL** : `http://localhost:3000/api/auth/register`
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

* **Connexion (Login)**
  * **Méthode** : `POST`
  * **URL** : `http://localhost:3000/api/auth/login`
  * **Body (JSON)** :
    ```json
    {
      "email": "admin@valiha.com",
      "password": "password123"
    }
    ```
  * ⚠️ * N'oubliez pas de copier manuellement le token retourné pour la suite.*

* **Mon Profil**
  * **Méthode** : `GET`
  * **URL** : `http://localhost:3000/api/auth/profile`
  * **Auth** : Bearer Token (Coller le token copié)

---

### 3. 👥 Utilisateurs (`/api/users`)

* **Lister tous les utilisateurs (Admin uniquement)**
  * **Méthode** : `GET`
  * **URL** : `http://localhost:3000/api/users`
  * **Auth** : Bearer Token (Coller le token copié)

---

### 4. 🏫 Universités (`/api/universites`)

* **Lister les universités**
  * **Méthode** : `GET`
  * **URL** : `http://localhost:3000/api/universites`
  * 💡 * Utile pour récupérer l'UUID d'une université avant de soumettre un mémoire.*

* **Créer une université (Protégé)**
  * **Méthode** : `POST`
  * **URL** : `http://localhost:3000/api/universites`
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
  * **URL** : `http://localhost:3000/api/domaine`
  * 💡 * Utile pour récupérer l'UUID d'un domaine avant de soumettre un mémoire. *

* **Créer un domaine (Protégé)**
  * **Méthode** : `POST`
  * **URL** : `http://localhost:3000/api/domaine`
  * **Auth** : Bearer Token (Coller le token copié)
  * **Body (JSON)** :
    ```json
    {
      "nom": "Informatique",
      "description": "Domaine de l'informatique et des sciences du numérique"
    }
    ```

---

### 6. 🎓 Mémoires - Recherche & Action (`/api/memoires`)

* **Recherche classique**
  * **Méthode** : `GET`
  * **URL** : `http://localhost:3000/api/memoires/search`
  * **Query Parameters** (Onglet Query, Optionnels) :
    * `q` : `informatique`
    * `annee` : `2023`
    * `typeDiplome` : `LICENCE` (ou `MASTER`, `DOCTORAT`)
    * `universiteId` : `(UUID)`
    * `domaineId` : `(UUID)`

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
  * **Auth** : Bearer Token (Coller le token copié)
  * **Body** : Sélectionnez **Form-encoded** -> **Form-data** dans Thunder Client.
    * `file` : * (Changez le type "Text" en "File" à droite du champ et uploadez un PDF) *
    * `titre` : `Développement d'une API`
    * `resume` : `Un super résumé...`
    * `anneeSoutenance` : `2024`
    * `typeDiplome` : `MASTER`
    * `auteurNom` : `Doe`
    * `auteurPrenom` : `Jane`
    * `auteurEmail` : `jane@example.com`
    * `universiteId` : `(UUID valide)`
    * `domaineId` : `(UUID valide)`

---

### 7. 🛡️ Modération (`/api/moderation`)

* (Ces endpoints nécessitent le rôle `DOCUMENTALISTE` ou `ADMIN`) *

* **Lister les mémoires en attente**
  * **Méthode** : `GET`
  * **URL** : `http://localhost:3000/api/moderation/pending`
  * **Auth** : Bearer Token (Coller le token copié)

* **Mettre à jour le statut d'un mémoire**
  * **Méthode** : `PATCH`
  * **URL** : `http://localhost:3000/api/moderation/:id/status` (Remplacez `:id` dans l'URL)
  * **Auth** : Bearer Token (Coller le token copié)
  * **Body (JSON)** :
    ```json
    {
      "statut": "VALIDE" 
    }
    ```
    * (Valeurs: BROUILLON, EN_ATTENTE_MODERATION, VALIDE, REJETTE) *
    * Note: Si rejeté, ajoutez `"motifRejet": "Raison du rejet"`.*

---

### 8. 📊 Analytics & Graphes

* **Graphe de relations**
  * **Méthode** : `GET`
  * **URL** : `http://localhost:3000/api/graph/data`

* **Récupérer les KPIs**
  * **Méthode** : `GET`
  * **URL** : `http://localhost:3000/api/analytics/kpis`

* **Récupérer les données de graphiques (Charts)**
  * **Méthode** : `GET`
  * **URL** : `http://localhost:3000/api/analytics/charts`
