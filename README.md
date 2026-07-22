# Graphens AI

**Graphens AI** est une extension pour Visual Studio Code conçue pour accompagner les étudiants dans leurs travaux pratiques (TP) d'informatique grâce à un assistant de discussion intelligent intégré dans la barre latérale.

---

## 🎓 Pour les Étudiants

### Comment utiliser l'assistant ?
1. **Ouvrir le Chat** : Cliquez sur l'icône Graphens AI dans la barre latérale secondaire de VS Code pour ouvrir l'interface de discussion.
2. **Sélectionner le mode (Agent)** : En haut de l'interface de discussion, vous pouvez choisir parmi plusieurs modes d'agent :
   * **ask** : Pour poser des questions rapides et générales.
   * **agent** : Pour des tâches autonomes plus poussées.
   * **plan** : Pour élaborer et suivre des plans de résolution.
   * **Graphens** : Le mode d'agent recommandé et optimisé pour vos travaux pratiques, qui exploite pleinement le contexte de votre TP.
3. **Interagir** : Saisissez vos messages pour poser des questions sur votre code, obtenir des explications sur les consignes ou recevoir des conseils de programmation.

*(Note : Un participant de chat classique est également accessible dans le panneau de chat natif de VS Code via la commande `@graphens`, mais il propose des fonctionnalités plus simplifiées par rapport aux modes d'agent de la barre latérale).*

### À quelles notifications s'attendre ? (Détecteur de blocage)
L'extension intègre un système intelligent appelé **Blocked Tracker** (détecteur de blocage). **Par défaut, il est désactivé.** Il peut être activé et personnalisé par l'enseignant via le fichier de configuration `.graphens/config.yaml`.
* **Comment ça marche ?** : Lorsqu'il est activé, si vous modifiez du code ou restez concentré sur la même ligne (ou dans la zone d'activité configurée) dans le même fichier pendant la durée spécifiée (5 minutes par défaut), l'extension détecte que vous rencontrez potentiellement une difficulté.
* **Notification reçue** : Une notification discrète s'affiche en bas à droite de votre écran :
  > ℹ️ **Information**  
  > *Vous modifiez autour de la ligne X dans "nom_du_fichier" depuis Y minutes. Besoin d'aide ?*
* **Vos options** :
  * **Demander à l'IA** : Si vous cliquez sur ce bouton, Graphens AI ouvre automatiquement l'interface de discussion avec le mode d'agent **Graphens** sélectionné et pré-remplit la question suivante pour vous faire gagner du temps :  
    `Je suis bloqué(e) à la ligne X de nom_du_fichier. Peux-tu m'aider à comprendre quel pourrait être le problème ?`
  * **Fermer** : Si vous préférez continuer à chercher par vous-même, vous pouvez simplement fermer la notification.

---

## 🏫 Pour les Enseignants

Vous pouvez configurer vos projets de TP afin de fournir un contexte riche et ciblé à l'assistant Graphens AI. Cela permet à l'IA de mieux comprendre le sujet du TP, les attentes pédagogiques, et d'apporter des réponses plus adaptées aux étudiants.

Le dossier de configuration doit être placé à la racine du projet sous le nom `.graphens/`.

### 1. Le fichier de configuration `.graphens/config.yaml`
Ce fichier permet de structurer les métadonnées et les sources d'information du TP. Créez un fichier `.graphens/config.yaml` (ou `.graphens/config.yml`) avec les champs optionnels suivants :

| Champ | Type | Description |
| :--- | :--- | :--- |
| `ue` | Chaîne | L'identifiant ou code de l'Unité d'Enseignement (ex: `LIFAP4`). |
| `cours` | Chaîne | Le nom du cours associé (ex: `Algorithmique et Programmation`). |
| `tp_name` | Chaîne | Le nom ou numéro du TP (ex: `TP2 - Listes Chaînées`). |
| `sources` | Liste d'URLs | Une liste d'URLs pointant vers des ressources distantes (fichiers texte ou JSON) à inclure comme contexte. |
| `blockers_detector` | Booléen ou Objet | Configuration du détecteur de blocage (désactivé par défaut). S'il est défini sur `true`, il s'active avec les paramètres par défaut. Il peut également être un objet contenant des options personnalisées : `period` (durée d'inactivité en minutes, défaut `5`) et `radius` (écart maximal en lignes pour rester dans la même zone d'intérêt, défaut `10`). |

#### Exemple de fichier `.graphens/config.yaml` :
```yaml
ue: "LIFAP4"
cours: "Algorithmique et Programmation"
tp_name: "TP3 - Arbres Binaires de Recherche"
sources:
  - "https://mon-serveur.univ.fr/cours/lifap4/tp3_sujet.txt"
  - "https://mon-serveur.univ.fr/cours/lifap4/cahier_des_charges.json"

# Activer le détecteur de blocage avec des paramètres personnalisés :
blockers_detector:
  period: 3  # Signaler après 3 minutes d'inactivité sur la même zone
  radius: 5  # Zone d'intérêt restreinte à 5 lignes de rayon (écart de 5 lignes)
```

### 2. Ajouter des instructions locales
Vous pouvez également placer un ou plusieurs fichiers Markdown directement dans le dossier `.graphens/` (par exemple : `.graphens/consignes.md`, `.graphens/indices.md`).

* Graphens AI va lire automatiquement tous les fichiers se terminant par `.md` dans le dossier `.graphens/`.
* Ces consignes seront combinées avec le contenu du `README.md` principal et les ressources distantes configurées dans les `sources`.
* L'ensemble de ces informations sera transmis à l'IA en tant que contexte de référence pour guider et personnaliser ses réponses.
