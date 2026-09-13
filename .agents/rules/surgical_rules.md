# Règles Chirurgicales & Boucle d'Élasticité (Protocole Brooks-Zero)

## 1. Principes Fondamentaux & Loi de Brooks-Zero
- **Bistouri Unique** : Le modèle principal agit comme l'unique **Chirurgien**. Une seule main écrit dans le code source du projet.
- **Topologie en Étoile Stricte** : Tous les échanges se font exclusivement entre le Chirurgien et un Sous-agent ($O(N)$). Les sous-agents ne communiquent JAMAIS directement entre eux pour éviter l'explosion combinatoire ($O(N^2)$).
- **Isolation Stricte** : Les sous-agents opèrent en mode `read-only` sur le code source. Leur seule zone d'écriture autorisée est un buffer temporaire : `.agents/scratchpad/worker_{id}.md`.

---

## 2. Anti-Polling & Prévention de Consommation de Tokens (Leçon Astra/Luna)
*Incident documenté : Un orchestrateur réinjectant 150k de contexte toutes les 30s juste pour vérifier un statut consomme ~7M de tokens en pur gaspillage.*

- **Interdiction Totale du Busy-Polling** :
  - Ne JAMAIS boucler toutes les 15 ou 30 secondes pour demander « est-ce que le worker a fini ? ».
  - Exploiter les réveils événementiels réactifs natifs (le runtime réveille l'orchestrateur automatiquement à la fin de la tâche ou à l'arrivée d'un message).
  - Si un timer d'attente est requis, privilégier des durées longues calquées sur la tâche (ex. 15–25 minutes) et ne jamais interrompre un agent sain sous prétexte d'un timer court expiré.
- **Zéro Duplication de Travail** :
  - Pendant qu'un worker effectue une recherche ou une compilation, le Chirurgien ne doit pas ré-exécuter la même recherche ou ré-ingérer les mêmes fichiers.
  - Le Chirurgien reste suspendu jusqu'à la livraison du livrable dans le scratchpad ou une notification d'erreur.

---

## 3. Boucle Logique d'Élasticité (Dynamic Scaling Policy)
Par défaut : **Pool = 1 (Chirurgien seul)**.

### A. Conditions d'Ajout (Scale-Up / Spawn)
Instancier un sous-agent éphémère UNIQUEMENT si au moins une condition suivante est satisfaite :
1. **Isolation stricte de recherche / audit** : Analyse statique, audit de sécurité (règles Firestore/Storage) ou revue de dépendances sans écriture.
2. **Cloisonnement de contexte volumineux** : Tâche nécessitant l'ingestion d'une documentation externe ou d'un rapport massif (> 20k-30k tokens) qui saturerait inutilement la fenêtre de travail du Chirurgien.
3. **Explosion combinatoire de tests** : Analyse comparative ou suites de vérifications indépendantes exécutables en parallèle.

> **Contraintes d'instanciation :**
> - Modèle économique et rapide par défaut (ex. Flash / Flash Lite).
> - Permissions : `read-only` sur le dépôt, écriture uniquement dans `.agents/scratchpad/worker_{id}.md`.
> - Plafond strict : **Maximum 2 sous-agents actifs simultanément**.

### B. Conditions de Retrait (Scale-Down / Kill Immédiat)
Détruire immédiatement le sous-agent et récupérer la main si :
1. **Conflit logique** : Proposition contredisant les décisions arrêtées dans `.agents/memory/decisions.md`.
2. **Taux de reprise élevé** : Le Chirurgien doit corriger ou recadrer la sortie de l'agent plus d'une fois.
3. **Fin de mission unitaire** : Dès que l'analyse ou la note de synthèse est déposée dans le scratchpad.
4. **Surconsommation de tokens** : Absence de livrable exploitable après le premier tour de travail.

---

## 4. Protocole de Mémoire (« Découper, Trancher, Garder »)
- **Découper** : Chaque sous-tâche est confinée dans un fichier éphémère `.agents/scratchpad/worker_{id}.md`.
- **Trancher** :
  1. Le Chirurgien lit la synthèse dans le scratchpad.
  2. Le Chirurgien valide, amende ou rejette les propositions.
  3. Le Chirurgien applique lui-même les modifications dans le codebase.
- **Garder** :
  - Toute décision d'architecture, règle de sécurité Firebase ou arbitrage technique majeur est acté dans `.agents/memory/decisions.md` avec son « Pourquoi ».
  - Les fichiers `.agents/scratchpad/*` sont purgés dès la fin du merge ou du cycle de travail.
