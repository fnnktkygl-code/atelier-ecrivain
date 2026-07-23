# Plan d'action — Routage de modèles IA quota-conscient & vérification sourcée
### Atelier d'Écrivain — à distribuer à l'équipe d'agents

---

## 0. Rappel des faits établis (issus de l'audit du dashboard réel + du code)

Ce plan part de constats vérifiés, pas d'hypothèses — chaque agent doit les tenir pour acquis :

1. Les quotas Gemini s'appliquent **par projet Google Cloud**, pas par utilisateur final. `system/quotas` (Firestore) est donc à raison partagé entre tous les auteurs de l'app — mais aujourd'hui c'est **un seul compteur global pour tous les modèles**, alors que chaque modèle a son propre quota indépendant sur le dashboard.
2. Quotas réels confirmés sur le projet (RPM / TPM / RPD) :
   - `gemini-3.6-flash`, `gemini-2.5-flash`, `gemini-3.5-flash` : 5 / 250K / 20 chacun
   - `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite` : 15 / 250K / 500 chacun
   - `gemini-2.5-flash-tts`, `gemini-3.1-flash-tts` : 3 / 10K / 10 chacun
   - `gemini-2.5-pro`, `gemini-3.1-pro` : 0 / 0 / 0 (pas de quota accordé sur ce projet)
   - `gemini-2.5-flash-native-audio-dialog`, `gemini-3-flash-live`, `gemini-3.5-live-translate` : RPM/RPD illimités, seul le TPM (1M / 65K / 20K) plafonne
   - `imagen-4-fast-generate`, `imagen-4-generate`, `imagen-4-ultra-generate` : 25/jour chacun (75 au total)
   - `gemini-embedding-1`, `gemini-embedding-2` : 100 RPM / 1000 RPD chacun
   - `gemma-4-26b`, `gemma-4-31b` : 30 RPM / 14 400 RPD chacun (modèle texte, pas de sortie audio/image)
3. **Ancrage (grounding) = quota séparé de la génération**, à deux dimensions :
   - *Ancrage de recherche* (Google Search) : 1 500/jour, mais **seulement pour les familles Gemini 2 et Gemini 2.5** — `0/0` pour Gemini 3 sur ce projet.
   - *Ancrage selon la carte* (Maps) : 500/jour sur la plupart des modèles, mais `0/0` pour `gemini-3.5-flash` et `gemini-3.6-flash` spécifiquement. Disponible même pour `Deep Research Pro Preview` (dont le quota de génération propre est `0/0`).
4. **Faille de conception actuelle confirmée dans le code** : `SYSTEM_PROMPT_FACTCHECK` (`services/ai/prompts.ts`) demande au modèle un champ `source` et un statut `confirmed/caution/error` pour des citations religieuses/historiques, mais **aucun outil de grounding n'est branché** dans `transcription.ts` (aucune occurrence de `tools`, `googleSearch`, `grounding`). Le modèle invente donc ce champ depuis sa mémoire paramétrique. C'est le problème prioritaire de ce chantier.
5. **Bug de fuseau horaire dans `quotaTracker.ts`** : les quotas Gemini se réinitialisent à minuit **Pacifique**, mais `getTodayString()` utilise `new Date().toISOString().slice(0,10)`, donc un jour **UTC**. Décalage possible jusqu'à 8h (16h en heure d'été) où l'app croit le quota réinitialisé alors qu'il ne l'est pas côté serveur, ou l'inverse.
6. Il n'existe pas d'API cliente fiable pour lire le quota restant en temps réel : toute la logique doit rester **auto-déclarative** (on compte ce qu'on envoie) et **réactive aux erreurs 429** (on se met en cooldown quand le serveur dit non), jamais une simple confiance dans un compteur local.

---

## 1. Objectif de ce chantier

Remplacer le compteur de quota global unique par un **routeur de modèles par fonctionnalité**, conscient des quotas réels par modèle et par type d'usage (génération vs ancrage), et corriger la fonctionnalité de vérification factuelle pour qu'elle soit réellement sourcée plutôt que déclarative.

Ce chantier est indépendant du module d'export PDF (voir document séparé), mais les deux se rejoignent sur un point : le générateur de couverture par IA (Imagen 4), pour l'instant réservé dans l'architecture d'export, devra consommer ce même routeur plutôt que d'implémenter sa propre logique de quota.

---

## 2. Architecture cible

```
src/services/ai-router/
├── types/
│   ├── modelRegistry.ts     # config statique des quotas connus par modèle
│   └── featureChains.ts     # FeatureId -> liste ordonnée de modèles, par contexte
│
├── quota/
│   ├── quotaStore.ts        # lecture/écriture Firestore, un bucket par (modèle, type de quota)
│   └── resetSchedule.ts     # calcul du jour courant en heure Pacifique (remplace getTodayString)
│
├── router/
│   ├── selectModel.ts       # choisit le premier modèle de la chaîne avec quota disponible
│   └── recordUsage.ts       # enregistre l'usage + gère le cooldown après une 429
│
└── services/
    ├── dictation.ts         # remplace l'usage direct de MODEL_FALLBACK_CHAIN dans transcription.ts
    ├── factCheck.ts         # nouveau : appel dédié avec outil de recherche Google branché
    ├── tts.ts                # nouveau : lecture vocale de chapitre
    └── coverGeneration.ts    # nouveau : génération de couverture (consommé par le module export)
```

`src/services/ai/quotaTracker.ts` et la logique de fallback actuelle dans `transcription.ts` sont **remplacés**, pas dupliqués — les appelants existants (`AtelierPage`, `QuotaBadge`) sont mis à jour dans le même lot que la suppression pour ne jamais laisser deux systèmes de quota coexister.

---

## 3. Contrats gelés (Lot 0 — à merger avant tout le reste)

```ts
// types/modelRegistry.ts
export type QuotaKind = 'generation' | 'groundingSearch' | 'groundingMaps';

export interface ModelQuotaLimits {
  rpm: number | null;   // null = illimité
  rpd: number | null;
  tpm: number | null;
}

export interface ModelEntry {
  id: string;                 // ex. 'gemini-2.5-flash'
  family: 'gemini-2' | 'gemini-2.5' | 'gemini-3' | 'gemini-3.1' | 'gemini-3.5' | 'gemini-3.6' | 'imagen-4' | 'gemma-4' | 'embedding';
  capabilities: ('text' | 'tts' | 'image' | 'live-audio' | 'translate')[];
  quotas: Partial<Record<QuotaKind, ModelQuotaLimits>>;
  // true si un appel a déjà échoué en 404/"not found" — permet de désactiver
  // un modèle mal orthographié ou pas encore disponible sans casser toute la chaîne
  knownUnavailable?: boolean;
}

// Ces valeurs sont un instantané du dashboard au moment de l'audit — à revalider
// périodiquement (Google modifie ces quotas sans préavis, cf. section 6).
export const MODEL_REGISTRY: ModelEntry[] = [ /* ... rempli en Lot A ... */ ];
```

```ts
// types/featureChains.ts
export type FeatureId =
  | 'dictation'          // dictée + structuration, priorité qualité
  | 'factcheck'          // vérification sourcée, DOIT avoir groundingSearch
  | 'tts'                // lecture vocale de chapitre
  | 'cover-generation'   // génération d'image de couverture
  | 'translation'        // traduction littéraire
  | 'global-analysis';   // relecture de cohérence sur plusieurs chapitres

export interface FeatureRequirement {
  requiredCapability: ModelEntry['capabilities'][number];
  requiredQuotaKind: QuotaKind;
  // Si aucun modèle de la chaîne n'a de quota et que ceci est true,
  // la fonctionnalité doit répondre en mode dégradé plutôt que d'halluciner un résultat
  // (cas concret : factcheck sans grounding disponible → ne jamais renvoyer "confirmed")
  degradeInsteadOfFallback: boolean;
  chain: string[]; // ids de ModelEntry, dans l'ordre de priorité
}

export const FEATURE_CHAINS: Record<FeatureId, FeatureRequirement> = { /* ... Lot A ... */ };
```

```ts
// router/selectModel.ts
export interface ModelSelection {
  modelId: string | null;   // null si aucun modèle disponible
  degraded: boolean;        // true si on est tombé sur un modèle de repli de moindre qualité
  reason?: 'quota-exhausted' | 'no-grounding-available' | 'unavailable';
}

export async function selectModel(feature: FeatureId): Promise<ModelSelection>;
export async function recordUsage(modelId: string, quotaKind: QuotaKind, outcome: 'success' | 'quota-error'): Promise<void>;
```

Toute l'équipe importe ces types tels quels ; aucun lot ne les modifie après le merge du Lot 0.

---

## 4. Lots parallélisables

- **Lot A — Registre des modèles & correctif de fuseau horaire**
  Remplit `MODEL_REGISTRY` et `FEATURE_CHAINS` avec les valeurs de la section 0. Implémente `resetSchedule.ts` (jour courant en heure Pacifique, avec tests couvrant le changement d'heure été/hiver). Livrable testable seul, aucune dépendance UI.

- **Lot B — Store de quota par modèle**
  `quotaStore.ts` : un document Firestore par `(modelId, quotaKind)` sous `system/quotas/{modelId}_{quotaKind}`, réutilisant le pattern de compteur partagé déjà en place (`increment`, `onSnapshot`) mais un bucket par entrée du registre au lieu d'un document unique. Doit gérer le cas où le compteur local et le compteur serveur divergent (le serveur — c'est-à-dire une 429 réelle — a toujours raison).

- **Lot C — Routeur**
  `selectModel.ts` / `recordUsage.ts`, au-dessus des Lots A et B. Logique : parcourt `FEATURE_CHAINS[feature].chain`, retient le premier modèle dont le quota (du bon `quotaKind`) a de la marge, marque `degraded: true` s'il ne s'agit pas du premier de la liste. Si `degradeInsteadOfFallback` est vrai et qu'aucun modèle n'a de marge, retourne `modelId: null` plutôt que de forcer un appel.

- **Lot D — Vérification factuelle sourcée (priorité du chantier)**
  `services/factCheck.ts` : appelle `selectModel('factcheck')`, qui ne renverra que `gemini-2.5-flash` ou l'équivalent « default » (seuls modèles avec `groundingSearch` non nul sur ce projet). Branche l'outil de recherche Google dans l'appel :

  ```ts
  const model = getGenerativeModel(ai, {
    model: 'gemini-2.5-flash',        // forcé pour cet appel, indépendant de la chaîne de dictée
    tools: [{ googleSearch: {} }],
    systemInstruction: SYSTEM_PROMPT_FACTCHECK,
  });

  const result = await model.generateContent(prompt);
  const grounding = result.response.candidates?.[0]?.groundingMetadata;
  const chunks = grounding?.groundingChunks ?? [];
  ```

  Le champ `source` de `VerificationItem` n'est plus écrit par le modèle lui-même : il est reconstruit à partir de `groundingChunks` (URLs réellement consultées). Si `selectModel` renvoie `null`, ou si `groundingChunks` est vide après l'appel, le statut retourné à l'UI doit être `'unverified'` (nouvelle valeur, à ajouter à `VerificationItem['status']` dans `types/manuscript.ts`) — **jamais** `'confirmed'` par défaut.

  **Contrainte contractuelle à respecter, pas optionnelle** : les conditions d'usage du grounding Google Search imposent d'afficher visuellement l'attribution de la recherche (`grounding.searchEntryPoint.renderedContent`, un widget "recherches associées" fourni par Google) à côté de tout résultat sourcé affiché à l'utilisateur. `ReviewPanel.tsx` doit donc prévoir un emplacement dédié pour ce widget (rendu tel quel, pas reformulé) chaque fois qu'une vérification a utilisé le grounding — pas seulement afficher le texte de la source.

  Adapte `ReviewPanel.tsx` pour afficher clairement « non vérifié aujourd'hui, quota de recherche épuisé » sur le statut `'unverified'`.

- **Lot E — Lecture vocale (TTS)**
  `services/tts.ts`, bouton dans `LiseusePage.tsx` (`🔊 Écouter ce chapitre`). Chaîne `['gemini-2.5-flash-tts', 'gemini-3.1-flash-tts']`. Prévoir un découpage du chapitre si sa longueur dépasse le TPM (10K) d'un seul appel.

- **Lot F — Génération de couverture (optionnel, lié au module export)**
  `services/coverGeneration.ts`, chaîne `['imagen-4-fast-generate', 'imagen-4-generate', 'imagen-4-ultra-generate']`. Ce lot n'est utile qu'une fois le module d'export (document séparé) arrivé à son Lot D (éditeur de couverture) — à ne démarrer qu'après confirmation que cette fonctionnalité est bien voulue (elle est actuellement optionnelle/expérimentale, voir mise à jour du document d'export ci-dessous).

- **Lot G — Migration & nettoyage**
  Supprime `services/ai/quotaTracker.ts` et `MODEL_FALLBACK_CHAIN` dans `transcription.ts`, remplace tous les points d'appel par `services/dictation.ts` (nouveau, wrapping `selectModel('dictation')`). Un seul lot pour tout le nettoyage, pour ne pas laisser deux systèmes de quota vivre en parallèle plus longtemps que nécessaire.

- **Lot H — UI de quota par fonctionnalité**
  Étend `QuotaBadge.tsx` (aujourd'hui un seul badge global) pour afficher un état par fonctionnalité active (dictée / vérification / lecture audio), avec bannière explicite en mode dégradé. Peut démarrer dès le Lot 0 avec des données mockées.

- **Lot I — Tests**
  Contre les interfaces du Lot 0 : sélection de modèle avec quota épuisé sur le premier de la chaîne, comportement `degradeInsteadOfFallback`, correction du fuseau horaire, non-régression sur le format de sortie de `factCheck.ts` attendu par `AtelierPage.tsx`.

- **Lot J — Intégration finale**
  Point de couture unique : remplacement des imports dans `AtelierPage.tsx` / `LiseusePage.tsx` vers les nouveaux services. À faire en dernier.

---

## 5. Ordre de priorité recommandé

1. Lot A + Lot B + Lot C (fondations du routeur) — bloquant pour tout le reste.
2. Lot D (fact-check sourcé) — c'est le correctif le plus important sur le plan de la confiance utilisateur, à traiter avant tout ajout de nouvelle fonctionnalité.
3. Lot G (nettoyage de l'ancien système) — en parallèle de D, pour ne pas laisser deux logiques de quota coexister longtemps.
4. Lot E (TTS) et Lot H (UI) en parallèle une fois B/C stables.
5. Lot F (couverture IA) seulement après validation explicite que cette fonctionnalité est priorisée — voir la mise à jour du document d'export.

---

## 6. Risques & points de vigilance pour tous les agents

- **Les valeurs de `MODEL_REGISTRY` sont un instantané, pas une garantie.** Google modifie ces quotas sans préavis (une réduction de 50 à 80 % a déjà eu lieu en décembre 2025 selon plusieurs sources). Le registre doit rester un fichier de configuration isolé et daté (commentaire avec la date de l'audit), facile à mettre à jour sans toucher au routeur.
- **Toujours traiter une erreur 429 comme prioritaire sur le compteur local** : si le serveur dit quota dépassé alors que notre compteur pense qu'il reste de la marge, on fait confiance au serveur et on met ce modèle en cooldown jusqu'à la prochaine réinitialisation Pacifique.
- **Ne jamais transformer un manque de quota en un résultat de moindre confiance déguisé en résultat normal.** C'est précisément le bug qu'on corrige avec `factcheck` — ne pas le réintroduire ailleurs (ex. TTS silencieusement remplacé par un modèle de moins bonne qualité sans le signaler dans l'UI).
- **BYOK (clé API personnelle)** évoqué précédemment : si implémenté un jour, ne pas annoncer un quota « illimité » à l'utilisateur — rester factuel (« vos propres quotas Google s'appliquent alors »).
