---
title: Tessera
status: final
created: 2026-10-21
updated: 2026-10-21
---

# PRD : Tessera

## 0. Objet du document

Ce PRD décrit la **v1 testable** de Tessera : la première version que l'utilisateur pourra essayer de bout en bout, jusqu'à un `.jar` chargé dans Minecraft. Il s'appuie sur le [brief](../../briefs/brief-tessera-2026-10-12/brief.md) et sur le MVP web déjà codé (`src/`). Il alimente l'architecture, puis les epics et stories.

- Le vocabulaire est fixé par le Glossaire (§3).
- Les exigences (FR) sont numérotées FR-1 à FR-N et regroupées par fonctionnalité.
- Les choix techniques sont dans [addendum.md](addendum.md).
- Ce PRD a été rédigé sans entretien, à la demande de l'utilisateur. Les points déduits portent la mention `[HYPOTHÈSE]` et sont regroupés en §9.

## 1. Vision

Tessera est une application de bureau. Elle permet à quelqu'un qui ne connaît pas Java de créer un mod **NeoForge 1.21.1** en restant visuel du début à la fin : on modélise, on dessine des écrans, on relie des nœuds, puis on clique sur **Build** pour obtenir un `.jar`. Le code Java reste visible et modifiable à la marge, mais on n'est jamais obligé de l'écrire.

Le MVP actuel prouve que les quatre panneaux fonctionnent et que la génération de code est faisable. La v1 doit transformer cette démonstration en **outil** : une vraie application de bureau, des projets enregistrés sur disque, du contenu personnalisé (objets, blocs, créatures) et une compilation en un clic.

## 2. Utilisateurs

### 2.1 Besoins à satisfaire
- **Créer son premier mod sans apprendre Java.** C'est le besoin principal.
- **Voir le résultat en jeu rapidement** : passer de l'idée au `.jar` sans installer d'outils à part.
- **Garder la main** : pouvoir lire le code produit, l'éditer, ou l'éjecter vers un vrai IDE.
- **Préparer des menus FancyMenu** pour son serveur ou son modpack.

### 2.2 Hors cible (v1)
- Les moddeurs Java expérimentés qui travaillent déjà dans IntelliJ. Ils peuvent utiliser Tessera, mais on n'optimise pas pour eux.
- Les animateurs 3D : Blockbench reste l'outil pour animer.

### 2.3 Parcours utilisateurs clés

- **UJ-1. Léa crée son premier mod en dix minutes.**
  - Léa a 14 ans et joue avec des modpacks. Elle installe Tessera, choisit le modèle de projet « Mod de bienvenue » et le renomme.
  - Dans Nœuds, elle change le message de bienvenue et ajoute « Donner un objet ».
  - Elle clique sur **Build**. Tessera télécharge Java la première fois, compile, puis affiche « mod prêt » avec un bouton pour ouvrir le dossier.
  - Elle copie le `.jar` dans `mods/` et lance le jeu : le message et l'objet apparaissent.
  - **Cas d'erreur :** un nœud est mal relié. Le bouton Build signale l'erreur et l'emmène sur le nœud fautif, au lieu de lancer une compilation vouée à l'échec.

- **UJ-2. Hugo ajoute une baguette magique.**
  - Hugo crée un **objet personnalisé** « baguette » avec une texture de 16×16 pixels dessinée dans Tessera.
  - Il relie « Clic droit avec un objet (baguette) » à « Donner un effet (vitesse) » et à « Jouer un son ».
  - Il lance Build. En jeu, la baguette apparaît dans l'onglet créatif de son mod et fonctionne.

- **UJ-3. Inès conçoit le menu principal de son serveur.**
  - Inès crée une mise en page FancyMenu, place le logo de son serveur et un bouton « Rejoindre », puis exporte.
  - Elle dézippe l'export dans le dossier `.minecraft`. Le menu s'affiche au prochain lancement.

- **UJ-4. Sam crée une créature et l'anime ailleurs.**
  - Sam modélise un petit golem en cubes, puis l'enregistre comme **créature personnalisée** avec une couleur, des points de vie et une vitesse.
  - Il exporte le `.bbmodel` pour l'animer plus tard dans Blockbench.
  - En jeu, le golem apparaît grâce à son œuf d'apparition et se déplace avec un comportement simple : il erre et regarde les joueurs.

## 3. Glossaire

- **Projet** : un dossier sur disque contenant `tessera.json` et ses assets. Il contient exactement un **Mod**.
- **Mod** : le contenu NeoForge produit à partir d'un Projet, identifié par son **mod id**.
- **Modèle** : un ensemble de **Cubes** édité dans le panneau Modèle.
- **Cube** : un pavé défini par une position, une taille, un pivot, une rotation et une couleur.
- **Interface** : un écran conçu dans le panneau Interface. Sa **destination** est soit `mod` (classe Java), soit `fancymenu` (mise en page FancyMenu).
- **Élément** : un composant d'une Interface (bouton, texte, panneau, image).
- **Graphe** : l'ensemble des **Nœuds** et des **Liens** d'un Projet.
- **Nœud** : un **Événement**, une **Condition** ou une **Action**.
- **Côté** : serveur ou client. Il indique où un Événement se déclenche et où une Action peut s'exécuter.
- **Contenu personnalisé** : un **Objet**, un **Bloc** ou une **Créature** défini dans le Projet et enregistré par le Mod.
- **Texture** : une image PNG dessinée ou importée dans Tessera, utilisée par un Contenu personnalisé.
- **Build** : la compilation du Mod en `.jar` par Tessera.
- **Diagnostic** : une erreur ou un avertissement détecté avant le Build.
- **Modèle de projet** : un Projet d'exemple prêt à l'emploi, proposé à la création.

## 4. Fonctionnalités

### 4.1 Application de bureau et Projets

**Description :** Tessera s'installe comme une application de bureau sur macOS, Windows et Linux. Un Projet est un dossier lisible : `tessera.json` + `assets/`. On peut le versionner avec Git et le partager.

#### FR-1 : Application de bureau
L'utilisateur peut lancer Tessera comme une application native, sans navigateur ni serveur. Réalise UJ-1.
- L'application démarre en moins de 3 secondes sur une machine récente `[HYPOTHÈSE]`.
- Elle fonctionne hors ligne. Seuls les téléchargements du premier Build demandent Internet.

#### FR-2 : Créer, ouvrir et enregistrer un Projet sur disque
L'utilisateur peut créer un Projet dans un dossier, l'ouvrir et l'enregistrer.
- Ctrl/Cmd+S écrit `tessera.json`. Les images sont stockées dans `assets/` et non en base64 dans le JSON.
- L'écran d'accueil liste les projets récents.
- L'application refuse d'ouvrir un `tessera.json` invalide et explique pourquoi.

#### FR-3 : Modèles de projet
L'utilisateur peut partir d'un Modèle de projet. Réalise UJ-1.
- Au moins deux modèles sont proposés : « Projet vide » et « Mod de bienvenue ». Ce dernier contient un message à la connexion, un objet donné et un écran ouvert par une touche.

#### FR-4 : Sauvegarde de secours
Le Projet ouvert est sauvegardé automatiquement, pour qu'une fermeture brutale ne fasse rien perdre.

### 4.2 Modeleur (existant, à compléter)

**Description :** Un modeleur de cubes volontairement minimal, sans animation. Réalise UJ-4.

#### FR-5 : Éditer les Cubes
L'utilisateur peut ajouter, dupliquer, supprimer, déplacer, tourner et redimensionner des Cubes, au clavier, à la souris ou par saisie de valeurs. *(Fait dans le MVP.)*

#### FR-6 : Échanger avec Blockbench
L'utilisateur peut exporter et importer un `.bbmodel`. *(Fait dans le MVP.)*
- À l'export, chaque Cube devient un os de Blockbench.
- Un aller-retour export puis import conserve les positions, tailles, pivots et rotations.

#### FR-7 : Utiliser un Modèle pour une Créature
Un Modèle peut servir d'apparence à une Créature (FR-13). Tessera génère alors la classe Java du modèle et la texture correspondante.

### 4.3 Designer d'Interfaces (existant)

#### FR-8 : Concevoir une Interface
L'utilisateur peut placer, déplacer, redimensionner et réordonner des Éléments, et définir l'action de chaque bouton. *(Fait dans le MVP.)*

#### FR-9 : Export FancyMenu
L'utilisateur peut exporter une Interface `fancymenu` en `.zip` à décompresser dans `.minecraft`. Réalise UJ-3.
- **Critère d'acceptation :** l'import est validé sur une vraie installation de FancyMenu 3.x. Tant que ce n'est pas fait, l'export reste marqué « expérimental ».

### 4.4 Logique en Nœuds (existant, à étendre)

#### FR-10 : Éditer le Graphe
L'utilisateur peut ajouter des Nœuds, les relier, les supprimer et annuler ses actions. Les Diagnostics s'affichent en direct. *(Fait dans le MVP.)*

#### FR-11 : Nœuds liés au Contenu personnalisé
Les Nœuds qui demandent un identifiant (objet, bloc, créature) proposent les Contenus personnalisés du Projet en plus d'une saisie libre. Réalise UJ-2.
- Une nouvelle Action « Faire apparaître une créature » est ajoutée.

### 4.5 Contenu personnalisé (nouveau)

**Description :** Le Projet peut définir des Objets, des Blocs et des Créatures. Ils sont enregistrés dans un onglet créatif du Mod. Réalise UJ-2 et UJ-4.

#### FR-12 : Objets et Blocs
L'utilisateur peut créer un Objet (nom, Texture, taille de pile maximale) ou un Bloc (nom, Texture, dureté).
- Le Build génère les registres NeoForge, les modèles d'objet et de bloc en JSON, les textures, les traductions, la table de butin du bloc et l'onglet créatif.

#### FR-13 : Créatures
L'utilisateur peut créer une Créature : nom, Modèle, Texture générée, points de vie, vitesse et comportement prédéfini (passif errant) `[HYPOTHÈSE]`.
- Le Build génère l'entité, ses attributs, son rendu et un œuf d'apparition.

#### FR-14 : Éditeur de Texture
L'utilisateur peut dessiner une Texture de 16×16 pixels (crayon, gomme, remplissage, pipette) ou importer un PNG.

### 4.6 Code (existant)

#### FR-15 : Lire le code et écrire du code personnalisé
L'utilisateur voit tous les fichiers générés en lecture seule. Il peut modifier `CustomCode.java` et insérer du Java via le Nœud « Code Java ». *(Fait dans le MVP.)*

#### FR-16 : Éjecter le projet
L'utilisateur peut exporter le projet Gradle complet, avec le wrapper Gradle, pour continuer dans un IDE.

### 4.7 Build (nouveau)

#### FR-17 : Compiler en un clic
L'utilisateur clique sur **Build** et obtient `<modid>-<version>.jar`. Réalise UJ-1.
- Au premier Build, Tessera télécharge et met en cache un JDK 21 et Gradle si la machine n'en a pas.
- Le journal de compilation est visible. Une compilation qui échoue affiche les erreurs.
- Le Build est bloqué tant qu'il reste des Diagnostics de type erreur.
- Un bouton ouvre le dossier qui contient le `.jar`.

#### FR-18 : Lancer le jeu de test *(v1.1)*
L'utilisateur peut lancer un client Minecraft de développement (`runClient`) depuis Tessera.

## 5. Non-objectifs

- Pas d'animation : Blockbench s'en charge.
- Pas d'autre loader (Fabric, Forge) ni d'autre version de Minecraft que la 1.21.1.
- Pas de synchronisation du code Java vers les Nœuds.
- Pas d'édition collaborative ni de marketplace.
- Pas de configuration réseau sur mesure (paquets) en v1 : les Interfaces côté client utilisent des commandes.

## 6. Périmètre de la v1

### 6.1 Inclus
FR-1 à FR-17.

### 6.2 Reporté
- FR-18 (lancer le jeu de test) est prévu pour la v1.1.
- Comportements de créature avancés (hostile, apprivoisable) : v2.
- Recettes d'artisanat : v1.1 `[HYPOTHÈSE]`.

## 7. Indicateurs de succès

- **SM-1 :** le parcours UJ-1 se fait en moins de 10 minutes, Build inclus et hors téléchargement initial. Valide FR-3, FR-10 et FR-17.
- **SM-2 :** 100 % des Projets sans Diagnostic d'erreur compilent. Tout échec de compilation est un bug de Tessera. Valide FR-17.
- **SM-3 :** un aller-retour avec Blockbench ne fait perdre aucune donnée géométrique. Valide FR-6.
- **SM-C1 (à ne pas optimiser) :** le nombre de Nœuds proposés. On ne vise pas un catalogue énorme : la clarté passe avant l'exhaustivité. Contrebalance FR-11.

## 8. Questions ouvertes

1. Quelles versions exactes de NeoForge et de ModDevGradle épingler ? Elles sont à vérifier sur le Maven NeoForged au moment du premier Build réel.
2. Le format FancyMenu reconstitué est-il accepté par FancyMenu 3.x ? À valider en jeu.
3. Faut-il une licence open source pour le dépôt public ?
4. Faut-il signer et notariser l'application sur macOS pour la distribuer ?

## 9. Index des hypothèses

- §4.1 FR-1 : démarrage en moins de 3 secondes.
- §4.5 FR-13 : un seul comportement de créature en v1 (passif errant).
- §6.2 : recettes d'artisanat reportées en v1.1.
- §2.3 : la cible principale est un débutant d'environ 14 ans, hypothèse reprise du brief.
