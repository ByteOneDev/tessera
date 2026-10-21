# Tessera

Atelier de création Minecraft pour **NeoForge 1.21.1** : modeleur de cubes, designer d'interfaces (mod ou FancyMenu), logique en nœuds et éditeur de code.

## Lancer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173.

- `npm test` : lance les tests des générateurs (Java, `.bbmodel`, FancyMenu).
- `npm run build` : produit le build de production.

## Les 4 panneaux

| Panneau | Ce qu'il fait | Export |
|---|---|---|
| Modèle | Cubes : position, taille, pivot, rotation, couleur. Pas d'animation. | `.bbmodel`, un os par cube, prêt à animer dans Blockbench. Import `.bbmodel` possible. |
| Interface | Écrans de mod ou mises en page FancyMenu : boutons, textes, panneaux, images. | Classe `Screen` Java, ou `.zip` FancyMenu (expérimental). |
| Nœuds | Événement → conditions → actions, avec vérification serveur/client. | Java NeoForge (`ModEvents`, `ModClientEvents`, `ModKeys`). |
| Code | Fichiers du mod générés (lecture seule) + `CustomCode.java` (modifiable). | Bouton « Exporter le mod » : projet Gradle complet en `.zip`. |

Le projet est sauvegardé automatiquement dans le navigateur. **Enregistrer** et **Ouvrir** utilisent un fichier `.tessera.json`.

## Structure

```
src/
  project/   modèle de données, valeurs par défaut, store (Zustand + annuler/refaire)
  codegen/   génération Java, écrans, FancyMenu, assemblage du projet Gradle (+ tests)
  modeler/   vue 3D (React Three Fiber) et export/import Blockbench
  gui/       designer d'interfaces
  nodes/     catalogue des nœuds et éditeur (React Flow)
  code/      éditeur Monaco embarqué
docs/        artefacts BMAD (brief, addendum)
```

## Limites connues

- Pas encore d'application de bureau : il manque l'enveloppe Tauri, qui nécessite Rust.
- Pas de bouton « Build » qui produit directement un `.jar` : il faut Java 21 et Gradle (voir le README du zip exporté).
- Le format FancyMenu 3 est reconstitué et doit être validé sur une vraie installation.
- La version NeoForge (`21.1.172`) et la version ModDevGradle (`2.0.95`) sont fixées dans `src/codegen/modProject.ts` et sont à vérifier.
