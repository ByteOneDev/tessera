---
title: "Product Brief : Tessera"
status: approved
created: 2026-10-12
updated: 2026-10-21
---

# Product Brief : Tessera

> Brief rédigé en voie rapide. Les points marqués `[HYPOTHÈSE]` ont été déduits et restent à confirmer.

## Résumé

Tessera est une application de bureau pour créer du contenu Minecraft **NeoForge 1.21.1** sans être développeur Java. Elle réunit dans une seule fenêtre quatre panneaux qui partagent le même projet :

1. **Modeleur** : on assemble des cubes pour faire un mob, un personnage ou un objet. Il n'y a pas d'animation. Le modèle s'exporte au format Blockbench (`.bbmodel`) pour être animé là-bas.
2. **Interfaces** : on dessine des écrans, soit pour son mod, soit pour **FancyMenu** (menu titre, menus personnalisés).
3. **Nœuds** : on décrit la logique du mod en reliant des nœuds (événement → condition → action), comme les Blueprints d'Unreal, et non avec des blocs empilés.
4. **Code** : une vue Java du mod, générée à partir des nœuds. Elle sert à comprendre ce qui est produit, ou à écrire du code soi-même.

La promesse : passer d'une idée à un mod qui tourne en jeu, en restant visuel du début à la fin.

## Le problème

- **MCreator** est le seul outil « sans code » sérieux. Il repose sur des blocs empilés (Blockly), devient vite lourd pour une logique un peu riche, et produit un code difficile à reprendre. `[HYPOTHÈSE]`
- **Blockbench** est excellent, mais trop riche pour quelqu'un qui veut juste trois cubes et une texture.
- **FancyMenu** se configure en jeu, sans outil dédié pour préparer une mise en page.
- **Coder un mod NeoForge** à la main suppose Java, Gradle, un IDE et la connaissance des registres et des événements. C'est un mur pour un débutant.

Résultat : un créateur doit jongler entre 3 ou 4 outils, ou abandonner.

## La solution

Un seul projet Tessera (un dossier avec un `tessera.json` et ses assets) relié aux quatre panneaux :

- Ce qui est modélisé ou dessiné peut être utilisé dans les nœuds, par exemple « ouvrir l'écran X » ou « faire apparaître le mob Y ».
- Les nœuds génèrent du Java NeoForge lisible, visible en direct dans le panneau Code.
- Le bouton **Build** produit un `.jar` à déposer dans le dossier `mods/`. Il nécessite un JDK 21 téléchargé automatiquement.
- Chaque panneau sait aussi exporter seul : `.bbmodel`, mise en page FancyMenu, sources Java.

## Ce qui rend Tessera différent

- **Des nœuds plutôt que des blocs.** Une logique avec des branches reste lisible, et on voit le flux d'exécution.
- **La simplicité assumée.** Le modeleur fait le strict minimum, et l'animation est renvoyée vers Blockbench au lieu d'être réinventée.
- **FancyMenu intégré.** À notre connaissance, aucun outil de mod ne propose de designer FancyMenu. `[HYPOTHÈSE]`
- **Pas de piège.** Le code généré est propre et peut être « éjecté » pour continuer dans un vrai IDE.

Il n'y a pas d'avantage technique impossible à copier. L'avantage, c'est l'expérience et la cohérence entre les quatre panneaux.

## Pour qui

- **Cible principale : le créateur débutant à intermédiaire.** Il joue avec des mods, veut créer les siens, mais ne connaît pas Java. `[HYPOTHÈSE]`
- **Cible secondaire : les administrateurs de serveurs et créateurs de modpacks.** Ils veulent un menu FancyMenu soigné et de petits mods sur mesure.
- **Cible tertiaire : les développeurs**, qui prototypent vite puis éjectent le code.

## Critères de succès

- Un utilisateur crée un mod « quand un joueur rejoint, il reçoit un message et un objet » en **moins de 10 minutes**, sans écrire de code. `[HYPOTHÈSE]`
- Le `.jar` produit se charge sans erreur dans NeoForge 1.21.1.
- Un modèle exporté s'ouvre dans Blockbench sans perte (cubes, pivots, rotations, UV).
- Une mise en page exportée s'importe dans FancyMenu.

## Périmètre de la v1

**Inclus :**
- Le projet et ses quatre panneaux.
- Les principaux nœuds d'événements (joueur rejoint, clic droit avec un objet, bloc cassé, mob tué), de conditions et d'actions (message, donner un objet, téléporter, jouer un son, ouvrir un écran).
- Des éléments personnalisés : un objet, un bloc et une entité simple qui utilise un modèle du modeleur.
- Les exports : `.bbmodel`, FancyMenu, sources Java, puis `.jar` via Gradle.

**Exclu :**
- L'animation.
- Les autres loaders (Fabric, Forge) et les autres versions de Minecraft.
- La synchronisation dans les deux sens entre le code et les nœuds : le code écrit à la main passe par un nœud « code personnalisé ».
- Le multijoueur collaboratif.
- La marketplace.

## Vision

Si la v1 fonctionne, Tessera devient l'atelier de référence pour les créateurs Minecraft. Pistes : une bibliothèque de nœuds partagés par la communauté, des modèles de projet (mini-jeux, menus serveur), d'autres versions de Minecraft, et des datapacks.
