# Addendum PRD : Tessera

Ce document regroupe le détail technique qui sert à l'architecture.

## Pistes d'implémentation par exigence

- **FR-1** : Tauri 2. Le front React existant est réutilisé tel quel, et la partie Rust gère les fichiers et les processus.
- **FR-2** : commandes Tauri `read_project` et `write_project`. Les images en data URL sont converties en fichiers `assets/*.png` à l'écriture, et reconverties à la lecture.
- **FR-12 et FR-13** : registres NeoForge `DeferredRegister.Items/Blocks` et `DeferredRegister<EntityType<?>>`. Les attributs passent par `EntityAttributeCreationEvent`, le rendu par `EntityRenderersEvent.RegisterRenderers` et `RegisterLayerDefinitions`.
- **FR-17** : JDK Temurin 21 téléchargé dans le dossier de données de l'application (`app_data_dir/jdk`). Gradle est distribué via un wrapper intégré aux ressources de Tauri. Le Build lance `gradlew build` dans `app_data_dir/builds/<modid>` et transmet le journal au front sous forme d'événements.

## Environnement de développement (2026-10-21)

- Java 21 (OpenJDK, Homebrew), Rust stable (rustup) et Node 26 sont installés.
- Aucun mod n'a encore été compilé ni testé en jeu, à la demande de l'utilisateur.
