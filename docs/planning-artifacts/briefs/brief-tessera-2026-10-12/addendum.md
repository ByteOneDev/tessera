# Addendum : Tessera

Ce document regroupe le détail technique qui sert à l'architecture, mais qui n'a pas sa place dans le brief.

## Stack retenue

| Couche | Choix |
|---|---|
| Application de bureau | Tauri 2. Le front est développé d'abord en web avec Vite ; Tauri l'emballera quand Rust sera installé. |
| Interface | React + TypeScript |
| État | Zustand, avec annuler/refaire |
| Modeleur | three.js via React Three Fiber + drei |
| Designer d'interfaces | Canevas 2D maison, en DOM absolu sur une grille à l'échelle des GUI Minecraft |
| Nœuds | React Flow (`@xyflow/react`) |
| Code | Monaco Editor |
| Build du mod | Modèle de projet Gradle NeoForge MDK 1.21.1 + JDK 21 Temurin, gérés côté Tauri |

## Principes

- **Une seule source de vérité :** le projet (`tessera.json`). Chaque panneau en lit et en écrit sa propre partie.
- **Génération de code en sens unique :** nœuds → Java.
- **Un seul loader :** NeoForge 1.21.1, mod id en minuscules (`[a-z0-9_]`).

## Environnement de développement constaté (2026-10-21)

- Node 26 et npm 11 sont installés.
- Rust/cargo, Java et uv ne sont pas installés.
