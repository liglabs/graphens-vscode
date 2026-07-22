# Guide de Contribution - Architecture de Graphens AI

Ce document décrit l'architecture générale du projet Graphens AI et fournit les lignes directrices pour le développement, le build, le versionnage, l'installation et la publication.

---

## Table des Matières

1. [Architecture Globale](#architecture-globale)
2. [Point d'Entrée et Enregistrement de l'Extension](#point-dentree-et-enregistrement-de-lextension)
3. [Model Context Protocol (MCP)](#model-context-protocol-mcp)
   - [Le Serveur MCP de l'Espace de Travail](#le-serveur-mcp-de-lespace-de-travail)
   - [L'Intégration Client MCP](#lintégration-client-mcp)
4. [Agent utilisant le MCP](#agent-utilisant-le-mcp)
5. [Le Participant au Chat (Chat Participant)](#le-participant-au-chat-chat-participant)
6. [Détecteur de Blocage (Blocked Tracker)](#détecteur-de-blocage-blocked-tracker)
7. [Cycle de Vie (Versionnage, Build, Publication et Installation)](#cycle-de-vie-versionnage-build-publication-et-installation)
   - [Installation en Mode Développement](#installation-en-mode-développement)
   - [Processus de Build](#processus-de-build)
   - [Versionnage avec Changesets](#versionnage-avec-changesets)
   - [Publication Automatisée (CI/CD)](#publication-automatisée-cicd)
   - [Installation Finale par l'Utilisateur](#installation-finale-par-lutilisateur)

---

## Architecture Globale

Graphens AI est une extension pour VS Code structurée sous forme de monorepo à l'aide de pnpm workspaces. Elle se compose de trois packages principaux :
- **Extension principale** : L'extension VS Code qui sert de pont entre l'EDI et les modèles de langage.
- **Frontend UI (`ui`)** : Interface graphique de chat de type webview (Svelte / Tailwind CSS / DaisyUI). *Note : Ce package n'est pas actif actuellement dans l'extension VS Code, mais il est conservé dans le monorepo comme base de travail et template pour le futur.*
- **Serveur MCP (`mcp`)** : Un serveur Model Context Protocol qui fournit des outils spécifiques au contexte du travail pratique (TP).

---

## Point d'Entrée et Enregistrement de l'Extension

Le point d'entrée de l'extension VS Code est situé dans le fichier [src/extension.ts](./src/extension.ts). 

Lors du chargement de l'extension, la méthode [activate](./src/extension.ts#L11) configure et souscrit les composants suivants auprès de l'API VS Code :
- **Chat Participant** : Enregistre le participant de chat via la méthode `vscode.chat.createChatParticipant` en associant l'identifiant de configuration [config.static.ts](./src/config.static.ts) et la méthode de traitement des requêtes [responde](./src/participant/GraphensParticipant.ts#L30) de la classe [GraphensParticipant](./src/participant/GraphensParticipant.ts#L22).
- **McpServerDefinitionProvider** : Enregistre localement le serveur MCP sous l'identifiant `graphens-workspace-mcp` via la fonction `vscode.lm.registerMcpServerDefinitionProvider`. Cela déclare le serveur local pour les modèles de langage de VS Code sous forme d'une commande d'exécution standard d'un processus Node.js vers `mcp/dist/index.mjs` en passant le dossier racine de l'espace de travail (`projectRoot`).
- **Blocked Tracker** : Lance l'écouteur proactif de détection des blocages en appelant [startBlockedTracker](./src/proactiveNotifications/blockedTracker.ts#L26).

---

## Model Context Protocol (MCP)

Le projet fait un usage important du protocole MCP pour permettre à l'IA d'interagir intelligemment avec le contexte local du TP de l'étudiant.

### Le Serveur MCP de l'Espace de Travail

Développé dans le répertoire `/mcp`, ce serveur est codé en TypeScript. Le point d'entrée [mcp/src/index.ts](./mcp/src/index.ts) instancie un `McpServer` et l'associe à un transport Stdio.

Il expose deux outils de contexte essentiels définis dans [mcp/src/functions.ts](./mcp/src/functions.ts) :
1. `tp_info` : Analyse le fichier de configuration `.graphens/config.yaml` ou `.graphens/config.yml` à l'aide de la structure définie dans [mcp/src/GraphensConfig.ts](./mcp/src/GraphensConfig.ts) pour extraire l'Unité d'Enseignement (`ue`), le cours (`cours`) et le nom du TP (`tp_name`).
2. `tp_recommendations` : Lit le fichier `README.md` du TP, les instructions Markdown locales stockées dans `.graphens/*.md` ainsi que les fichiers distants configurés sous l'attribut `sources` du fichier de configuration YAML, puis rassemble l'ensemble de ces instructions pour guider le modèle.

### L'Intégration Client MCP

Le client MCP est géré au niveau de l'extension par le fichier [src/utils/mcp.ts](./src/utils/mcp.ts).
- **Connexion** : La fonction [initMcpClients](./src/utils/mcp.ts#L69) lit le fichier `.graphens/mcp.json` de l'espace de travail. Elle gère la connexion aux serveurs de type `stdio`, `sse` et `http` décrits par l'utilisateur. Pour les serveurs `stdio` sous Windows, elle encapsule l'exécution avec `cmd /c` et ajoute l'exécutable node au chemin global (`PATH`).
- **Résolution des Outils** : Les outils exposés par les serveurs MCP déclarés sont récupérés et enveloppés sous la forme d'outils compatibles VS Code (`vscode.LanguageModelChatTool[]`).
- **Appel d'Outil** : [callMcpTool](./src/utils/mcp.ts#L103) permet à l'agent de requêter un outil MCP par son nom qualifié (ex: `serveur____nomOutil`).

---

## Agent utilisant le MCP

L'agent principal Graphens est configuré déclarativement dans le fichier [agents/graphens.agent.md](./agents/graphens.agent.md).
- **Outils Autorisés** : L'agent a accès aux serveurs MCP connectés (comme `graphens-workspace-mcp` et `Graphens-RAG-MCP`) ainsi qu'à des outils natifs comme `execute`, `read` et `search`.
- **Rôle Pédagogique (Méthode Socratique)** : La consigne clé de cet agent est de guider l'étudiant vers la solution par des questions et des indices progressifs sans **jamais donner la solution directement**.
- **Récupération du Contexte** : L'agent appelle en priorité les outils de `graphens-workspace-mcp` (comme `tp_info` et `tp_recommendations`) pour s'imprégner des objectifs pédagogiques et du cours.

---

## Le Participant au Chat (Chat Participant)

La logique opérationnelle derrière le chat est structurée au sein de la classe [GraphensParticipant](./src/participant/GraphensParticipant.ts#L22).
- **Commandes** : Elle gère les slash-commandes spécifiques comme `/list_mcp` (affiche la liste complète des outils et clients MCP disponibles) et `/reload_mcp` (recharge la configuration des serveurs MCP sans devoir redémarrer l'extension).
- **Garde Anti-Triche** : Elle exécute [isCheating](./src/participant/guards/cheating.ts) sur les questions des étudiants. Si l'étudiant est détecté comme tentant de contourner les instructions ou d'exiger le code solution, la classe coupe court à la génération et envoie la réponse prédéfinie `RESPONSE_TO_CHEATER`.
- **Assemblage Contextuel et Envoi LLM** : Elle construit la liste finale de messages à envoyer au modèle en regroupant l'historique du chat, les informations du TP (issues du README, de la configuration globale, des erreurs actives détectées dans l'EDI, des fichiers ouverts) ainsi que le prompt système principal. Elle appelle ensuite le modèle avec auto-exécution des outils via `request.model.sendRequest`.

---

## Détecteur de Blocage (Blocked Tracker)

Le fichier [src/proactiveNotifications/blockedTracker.ts](./src/proactiveNotifications/blockedTracker.ts) implémente un système de détection proactif de blocage étudiant.
- **Activation** : Au démarrage, l'extension lit le fichier de configuration `.graphens/config.yaml`. Le tracker n'est instancié que si `blockers_detector` est activé (soit défini sur `true`, soit configuré avec un objet de paramètres). Par défaut, il est désactivé.
- **Fonctionnement** : Il s'abonne aux événements `vscode.workspace.onDidChangeTextDocument` à l'aide de flux de programmation réactive (RxJS).
- **Définition d'un Point d'Ancrage** : À chaque modification, il extrait un point d'ancrage constitué du chemin du fichier et de la ligne modifiée.
- **Détection** : L'opérateur RxJS `switchMap` redémarre un minuteur d'inactivité (par défaut **5 minutes**, configurable via la clé `period`). Si l'étudiant effectue d'autres modifications dans une zone proche (par défaut moins de **10 lignes** d'écart, configurable via la clé `radius`), l'ancrage reste considéré comme identique (grâce à l'opérateur `distinctUntilChanged`). Si aucune modification en dehors de cette zone ne survient avant la fin du minuteur, l'utilisateur est considéré comme "bloqué".
- **Interaction avec l'Agent** : Une notification d'information VS Code s'affiche alors : `"Vous modifiez autour de la ligne X dans "fichier" depuis Y minutes. Besoin d'aide ?"`. Si l'étudiant clique sur `"Demander à l'IA"`, l'extension ouvre automatiquement l'interface de chat de VS Code avec une requête pré-remplie demandant à l'agent d'aider à résoudre le problème à cette ligne précise.

---

## Cycle de Vie (Versionnage, Build, Publication et Installation)

Le projet utilise des outils récents du développement web pour automatiser les tâches de gestion du code.

### Installation en Mode Développement

1. **Prérequis** : Avoir installé Node.js (version 26 de préférence) et `pnpm`.
2. **Installation des dépendances** : Exécuter la commande suivante à la racine :
   ```bash
   pnpm install
   ```
3. **Lancement en mode veille (Watch)** : Pour développer, démarrer le compilateur en arrière-plan :
   ```bash
   pnpm watch
   ```
   Cette commande exécute simultanément les compilateurs en mode écoute pour l'extension principale (`watch:ext`), la webview UI template (`watch:ui`), et le serveur MCP (`watch:mcp`).
4. **Exécution dans VS Code** : Ouvrir le projet dans VS Code, puis appuyer sur `F5` pour lancer une instance d'évaluation de l'extension ("Run Extension").

### Processus de Build

La compilation de production est orchestrée par Turborepo à l'aide de la configuration définie dans [package.json](./package.json).
- **Compilation de Production** :
  ```bash
  pnpm vscode:prepublish
  ```
  Cette commande lance `turbo run build`, qui exécute de manière optimisée et parallèle les tâches suivantes :
  - Compilation de l'interface utilisateur Svelte template (`build:ui`). Note : Cette tâche n'est plus obligatoire pour le fonctionnement actuel de l'extension mais est conservée.
  - Compilation en TypeScript du serveur MCP (`build:mcp`).
  - Compilation en TypeScript de l'extension principale avec Vite (`build:ext`).

### Versionnage avec Changesets

Le versionnage du projet est géré avec l'outil Changesets.
- **Ajouter un changeset** : Lorsqu'un contributeur réalise une modification nécessitant un changement de version (mineur, majeur ou correctif), il doit exécuter :
  ```bash
  pnpm changeset
  ```
  L'outil pose des questions pour déterminer l'importance du changement et rédiger les notes de version, générant ensuite un fichier Markdown temporaire dans le répertoire `.changeset/`.
- **Mettre à jour les versions** : La commande `pnpm changeset version` applique ces fichiers pour incrémenter les versions dans les `package.json` et mettre à jour le `CHANGELOG.md`.

### Publication Automatisée (CI/CD)

Le processus de publication est entièrement automatisé par un workflow GitHub Actions défini dans [.github/workflows/release.yml](./.github/workflows/release.yml).
- Le workflow se déclenche sur chaque commit poussé sur la branche `main`.
- Il installe les dépendances avec `pnpm install --frozen-lockfile` et configure `@vscode/vsce` globalement.
- Il utilise l'action officielle Changesets (`changesets/action@v1`) :
  - **S'il y a des changesets non appliqués** : L'action crée ou met à jour une Pull Request nommée "Version Packages". Cette PR applique les versions de façon propre.
  - **Dès que cette Pull Request de version est mergée** : L'action détecte l'absence de changesets actifs, déclenche l'empaquetage de l'extension via la commande `pnpm package` (qui appelle `npx vsce package`), puis crée automatiquement une Release GitHub avec le tag `v<version>`, génère les notes de version, et téléverse le fichier `.vsix` d'extension généré (par exemple `graphens-vscode-0.7.0.vsix`).

### Installation Finale par l'Utilisateur

Pour installer l'extension construite en production :
- **À partir d'un fichier d'extension packagé (`.vsix`)** :
  - Télécharger le fichier `.vsix` correspondant depuis les Releases GitHub.
  - Dans VS Code, ouvrir la palette de commandes (`Ctrl+Shift+P` ou `Cmd+Shift+P`), sélectionner `Extensions: Installer à partir d'un VSIX...` (Install from VSIX...), puis choisir le fichier.
  - Alternativement, exécuter en ligne de commande :
    ```bash
    code --install-extension graphens-vscode-0.7.0.vsix
    ```
- **Depuis le Marketplace** (Une fois publié sur le magasin d'extensions) :
  - Rechercher "Graphens AI" directement dans l'onglet Extensions de VS Code et cliquer sur "Installer".
