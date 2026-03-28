# Analyse technique du projet PanelCut Pro

## Vue d'ensemble
- Stack front-end: React 18 + react-scripts (CRA) + Tailwind CSS.
- Domaine métier: optimisation de découpe de panneaux (algorithme guillotine récursif) + gestion de projets.
- Persistance: Supabase (auth OTP email + CRUD sur `projects`).

## Points forts
1. **Séparation claire entre UI et logique métier**
   - Le moteur d'optimisation est isolé dans `src/engine.js`, ce qui facilite les tests et les évolutions algorithmiques.
2. **UX moderne et lisible**
   - `ProjectsScreen` et `ImageUpload` proposent une expérience fluide (états visuels, feedback de chargement, design cohérent).
3. **Structure de données métier cohérente**
   - Les pièces, panneaux et métriques (waste/utilization) sont consolidés de manière exploitable côté rendu et export.

## Risques techniques observés
1. **Incohérence d'API Supabase (corrigée)**
   - `ProjectsScreen` appelait `createProject` sans export correspondant dans `src/supabase.js`.
   - Impact: crash au build/import (ou au runtime selon bundler).
2. **Clés/URLs sensibles en dur**
   - `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont codées en clair.
   - Recommandation: déplacer vers variables d'environnement (`REACT_APP_*`) + rotation de clé si nécessaire.
3. **Couplage fort au backend local pour le scan IA**
   - URL hardcodée `http://localhost:3001/scan` dans `ImageUpload`.
   - Recommandation: variable d'environnement + gestion multi-environnements (dev/staging/prod).
4. **`App.js` en mode démonstration**
   - Handlers `onLoad` / `onNew` utilisent encore des `alert`.
   - Recommandation: brancher le flux réel (auth/session/navigation/projet courant).

## Qualité du moteur de découpe (`engine.js`)
- L'approche guillotine récursive est correcte pour un compromis performance / qualité.
- Le bornage de profondeur (`depth > 30`) évite les récursions infinies.
- Le `knapsack1D` avec capacité plafonnée limite les dérives mémoire.
- Point de vigilance: absence de tests automatisés de non-régression (cas limites: grandes quantités, tolérance extrême, rotation ambiguë).

## Priorités recommandées (ordre d'impact)
1. **Industrialiser la configuration**
   - Externaliser URL/keys/API endpoints dans des `.env`.
2. **Ajouter une suite de tests**
   - Tests unitaires sur `optimise` (jeux de données fixes + snapshots des métriques).
3. **Finaliser le flux applicatif principal**
   - Session/auth, chargement d'un projet existant, édition et sauvegarde continue.
4. **Sécuriser l'observabilité**
   - Remplacer `alert` par un système de notifications + journalisation structurée.

## Correctif appliqué dans cette révision
- Ajout de la fonction `createProject` dans `src/supabase.js` pour aligner le contrat attendu par `ProjectsScreen`.
