---
title: Epics et stories : Tessera v1
status: final
created: 2026-10-21
sources: [prds/prd-tessera-2026-10-21/prd.md, architecture/architecture-tessera-2026-10-21/ARCHITECTURE-SPINE.md]
---

# Epics et stories : Tessera v1

Chaque story renvoie aux exigences du PRD (FR) et aux règles d'architecture (AD) qu'elle respecte.

## Epic 1 : Application de bureau et projets sur disque

**Objectif :** FR-1 à FR-4.

- **S1.1 : Coquille Tauri.** `src-tauri/` (Tauri 2) emballe le front Vite. `npm run tauri dev` ouvre Tessera dans une fenêtre native. *(FR-1, AD-6)*
- **S1.2 : Adaptateur Plateforme.** `src/platform/{index,web,tauri}.ts` regroupe les fonctions ouvrir/enregistrer un projet, choisir un dossier, exporter un fichier et sauvegarder en secours. Les composants n'importent plus `lib/files` directement. *(AD-6)*
- **S1.3 : Format disque et migrations.** `project/migrate.ts`. À l'écriture, les images sont extraites vers `assets/`, puis réinjectées à la lecture. `formatVersion` passe à 2. *(FR-2, AD-5)*
- **S1.4 : Écran d'accueil et modèles de projet.** Il propose « Projet vide » et « Mod de bienvenue », et liste les projets récents. *(FR-2, FR-3)*

## Epic 2 : Contenu personnalisé

**Objectif :** FR-7 et FR-11 à FR-14.

- **S2.1 : Modèle de données.** Types `Content` (objet, bloc, créature) avec `registryName` calculé. Ajout d'un panneau « Contenu ». *(AD-4)*
- **S2.2 : Éditeur de texture 16×16.** Crayon, gomme, remplissage, pipette et import PNG. *(FR-14)*
- **S2.3 : Génération des objets et blocs.** `DeferredRegister`, onglet créatif, modèles JSON, textures, traductions et table de butin. *(FR-12, AD-2)*
- **S2.4 : Génération des créatures.** EntityType, attributs, IA passive, classe de modèle générée à partir des cubes, rendu et œuf d'apparition. *(FR-7, FR-13)*
- **S2.5 : Nœuds liés au contenu.** Sélecteur `content:<id>` dans les paramètres et action « Faire apparaître une créature ». *(FR-11, AD-4)*

## Epic 3 : Build en un clic

**Objectif :** FR-16 et FR-17.

- **S3.1 : Versions épinglées et wrapper Gradle.** `codegen/versions.ts` avec les versions du MDK officiel. Le wrapper Gradle est inclus dans l'export. *(FR-16, AD-8)*
- **S3.2 : Commande Rust `build_mod`.** Elle écrit les fichiers, trouve ou télécharge le JDK 21, lance gradlew et diffuse le journal. *(FR-17, AD-7)*
- **S3.3 : Interface de Build.** Bouton Build, panneau de journal, blocage si des Diagnostics sont en erreur, et bouton « Ouvrir le dossier ». *(FR-17)*

## Epic 4 : Fiabilité

- **S4.1 : Export FancyMenu déterministe.** Les UUID sont dérivés des ids. *(AD-2)*
- **S4.2 : Validation en jeu (par l'utilisateur).** FancyMenu, `.jar` et `.bbmodel`. *(questions ouvertes 1 et 2 du PRD)*

## Ordre de réalisation

S3.1, puis S1.1 à S1.4, puis S2.1 à S2.5, puis S3.2 et S3.3, puis S4.1.
