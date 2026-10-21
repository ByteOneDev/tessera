# Tessera

Atelier de création Minecraft pour **NeoForge 1.21.1** : modeleur de cubes, designer d'interfaces (mod ou FancyMenu), logique en nœuds et éditeur de code.

## Lancer

Prérequis : Node 20+, Rust stable et, pour le Build, Java 21. Si Java 21 est absent, Tessera télécharge Temurin 21 au premier Build.

```bash
npm install
npm run desktop
```

`npm run desktop` lance l'application de bureau (Tauri). `npm run dev` lance la version web sur http://localhost:5173 : tout y fonctionne sauf le Build et les dossiers de projet.

Pour produire l'installateur : `npm run desktop:build`.

- `npm test` : lance les tests des générateurs (Java, `.bbmodel`, FancyMenu).
- `npm run build` : produit le build de production.

## Les 4 panneaux

| Panneau | Ce qu'il fait | Export |
|---|---|---|
| Contenu | Objets, blocs et créatures, éditeur de texture 16×16. | Registres NeoForge, modèles JSON, textures, onglet créatif, œufs d'apparition. |
| Modèle | Cubes : position, taille, pivot, rotation, couleur. Pas d'animation. | `.bbmodel`, un os par cube, prêt à animer dans Blockbench. Import `.bbmodel` possible. |
| Interface | Écrans de mod ou mises en page FancyMenu : boutons, textes, panneaux, images. | Classe `Screen` Java, ou `.zip` FancyMenu (expérimental). |
| Nœuds | Événement → conditions → actions, avec vérification serveur/client. | Java NeoForge (`ModEvents`, `ModClientEvents`, `ModKeys`). |
| Code | Fichiers du mod générés (lecture seule) + `CustomCode.java` (modifiable). | « Exporter » : projet Gradle complet avec wrapper, en `.zip`. |

**Build** (Ctrl/Cmd+B, application de bureau) compile le mod en `.jar` dans le dossier de données de Tessera, puis « Afficher le .jar » ouvre son dossier.

Dans l'application de bureau, un projet est un dossier qui contient `tessera.json` et `assets/*.png`. Dans la version web, c'est un fichier `.tessera.json`. Une sauvegarde de secours est faite en continu.

Le modèle de projet **« Mod de bienvenue »** est un exemple complet : à la connexion, un message et une pierre de bienvenue. Un clic droit avec la pierre invoque un compagnon modélisé en cubes, et la touche G ouvre un écran.

## Structure

```
src/
  project/   modèle de données, valeurs par défaut, store (Zustand + annuler/refaire), migrations, session
  codegen/   génération Java (logique, écrans, contenu), FancyMenu, projet Gradle, versions (+ tests)
  content/   panneau Contenu et éditeur de texture
  platform/  adaptateur web / Tauri, format disque, wrapper Gradle
  modeler/   vue 3D (React Three Fiber) et export/import Blockbench
  gui/       designer d'interfaces
  nodes/     catalogue des nœuds et éditeur (React Flow)
  code/      éditeur Monaco embarqué
src-tauri/   coquille de bureau (Rust) : fichiers, JDK 21, Build Gradle
docs/        artefacts BMAD (brief, PRD, architecture, epics)
```

## État et limites

- **Rien n'a encore été compilé ni testé dans Minecraft.** Le code Java vise NeoForge 21.1.264 et suit les API 1.21.1, mais il n'est vérifié que par des tests unitaires.
- L'export FancyMenu 3 est expérimental : le format est reconstitué et doit être validé en jeu.
- Une seule IA de créature (passive) pour l'instant. Pas de recettes ni de lancement du client de test (prévus en v1.1).
- Les versions de Minecraft, NeoForge, ModDevGradle et Gradle sont regroupées dans `src/codegen/versions.ts`.
