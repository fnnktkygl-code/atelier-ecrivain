# Conception — Module « Exporter mon livre » (Export PDF professionnel)
### Atelier d'Écrivain — Document de conception technique

---

## 0. Résumé exécutif

L'objectif est d'ajouter à Atelier d'Écrivain un module autonome permettant à un·e auteur·e de transformer son manuscrit en PDF de qualité éditoriale (couverture, pages liminaires, sommaire, typographie soignée, thèmes graphiques, métadonnées).

Point structurant de toute la conception : **l'application est un export statique Next.js (`output: 'export'`), servie sans backend applicatif** (Firebase Hosting + Firestore/Auth/Storage côté client uniquement, aucune Cloud Function). Cela élimine d'office les solutions serveur (Puppeteer, PDFKit côté Node) pour la V1, et oriente vers un moteur de rendu PDF **exécuté dans le navigateur**. Cette contrainte est décrite en détail en section 3 et gouverne tout le reste des choix.

Recommandation retenue : **@react-pdf/renderer** comme moteur principal (rendu déclaratif en React, pagination automatique, signets/TOC natifs, exécutable 100 % côté client), avec **pdf-lib** en complément pour des opérations de post-traitement (fusion de la couverture importée en image/PDF, métadonnées avancées, chiffrement optionnel). Une piste d'évolution V2 (Cloud Function + Chromium headless) est documentée pour qui voudrait dépasser les limites typographiques du rendu client (césure, veuves/orphelines fines).

Le document ci-dessous couvre : l'audit de l'existant, les choix techniques justifiés, l'architecture du module, le modèle de données, les flux utilisateurs, les maquettes d'écran (description textuelle), et un plan d'implémentation découpé en lots indépendants pour parallélisation par plusieurs agents.

Conformément à votre remarque, je me suis permis d'écarter ou de simplifier certains éléments de la liste initiale (détaillé en section 12), notamment tout ce qui relève de contenu long à taper par l'utilisateur (préface, avant-propos, postface, biographie...) que je regroupe dans un mécanisme générique de « pages de texte libre » plutôt que des champs dédiés un par un — plus simple à maintenir et tout aussi flexible pour l'utilisateur.

---

## 1. Analyse de l'existant

### 1.1 Stack technique

- **Next.js 16** en mode `output: 'export'` (`next.config.ts`) → build 100 % statique, aucune route API, aucun rendu serveur à l'exécution. Déployé sur Vercel (README) et/ou Firebase Hosting (`firebase.json`, dossier `out/`, rewrite SPA).
- **Firebase** : Auth (Google Sign-In), Firestore (données), Storage (fichiers audio/images, 10 Mo max, types autorisés : images png/jpeg/webp/gif, audio, JSON).
- **React 19**, TypeScript strict, ESLint 9.
- Pas de bibliothèque PDF dans `package.json` / `package-lock.json` à ce jour.

### 1.2 Modèle de données du manuscrit

Deux représentations coexistent :

1. **Domaine « édition »** (`src/types/editor.ts`), utilisé par l'éditeur (`useManuscript`) :
   - `ManuscriptState` → `EditableChapter[]`
   - `EditableChapter` = `{ id, title, blocks: TextBlock[], notes: EditableNote[], pendingReviews: PendingReview[] }`
   - `TextBlock` = `{ id, content, type: 'paragraph'|'heading'|'quote', source, createdAt }`
   - `EditableNote` = `{ id, key, content, source, attachedToBlockId? }`
   - Persistance : `localStorage` (clé `atelier-manuscrit-{manuscriptId}`, instantanée) + Firestore en arrière-plan (débounce 1 s), avec détection de conflit multi-appareil (`atelier_sync_conflict`).

2. **Domaine « stockage Firestore »** (`src/services/firebase/firestore.ts`) :
   - `users/{uid}/manuscripts/{manuscriptId}` → `{ title, createdAt, updatedAt, wordCount }`
   - `.../chapters/{chapterId}` → `ChapterData = { title, paragraphs: string[], order }`
   - `.../meta/notes` → `Record<string, string>`
   - `users/{uid}/profile/info` → `{ penName, avatarColor, avatarUrl, showEmail }`

3. Un troisième format existe encore : les données statiques historiques `src/data/chapters.ts` / `notes.ts` (utilisées pour la migration initiale et pour la Liseuse en fallback).

**Conséquence pour l'export** : le module d'export doit consommer le format `EditableChapter[]` (source de vérité vivante dans l'éditeur), pas directement Firestore, pour toujours exporter l'état le plus à jour y compris les modifications non encore synchronisées.

Un export existe déjà en germe : `useManuscript().exportMarkdown()` (téléchargement `.md` basique). Le nouveau module PDF est un travail parallèle et plus riche, mais peut réutiliser la même logique de linéarisation chapitre → blocs → texte.

### 1.3 Métadonnées déjà disponibles

- Titre du manuscrit (`Manuscript.title` / `ManuscriptMeta.title`)
- Nom de plume (`penName`, `profile/info`)
- Nombre de mots (`wordCount`, calculé)
- Titres de chapitres, ordre
- Notes (déjà numérotées) → candidates pour les notes de bas de page/fin d'ouvrage
- Aucune métadonnée éditoriale (auteur légal, ISBN, copyright, dédicace...) n'existe encore : tout est à créer.

### 1.4 Thème visuel existant

`ThemeProvider` gère un thème *jour/sépia/nuit* pour la lecture à l'écran (police serif/sans, `--text`, `--text-soft` en CSS vars). Ce thème n'est pas un thème éditorial de mise en page PDF — il faudra un système de thèmes dédié à l'export (section 6).

### 1.5 Sécurité (règles déjà en place, à réutiliser sans modification)

- `storage.rules` : `users/{uid}/**` accepte déjà images (png/jpeg/webp/gif) ≤ 10 Mo → **suffisant pour les images de couverture**, aucune modification requise si on stocke sous `users/{uid}/covers/...`.
- `firestore.rules` : sous-collection `meta/{metaId}` déjà ouverte en lecture/écriture au propriétaire → **suffisante pour stocker les préférences d'export** (`meta/exportSettings`) et l'historique (`meta/exportHistory` ou une sous-collection dédiée, à ajouter explicitement, voir section 7.3).

---

## 2. Contrainte structurante : rendu 100 % client

Parce que `next.config.ts` fixe `output: 'export'` :

- Il n'existe **aucune route API Next.js**, ni Cloud Function Firebase configurée. Toute génération de PDF doit s'exécuter **dans le navigateur de l'utilisateur**.
- Cela exclut d'emblée : Puppeteer/Playwright (nécessitent Chromium headless côté serveur), PDFKit en usage serveur classique, et toute solution qui suppose un environnement Node à l'exécution.
- Cela oriente vers des bibliothèques **conçues pour tourner dans un navigateur ou un Web Worker** : `@react-pdf/renderer`, `pdf-lib`, `jsPDF`.
- Avantage collatéral : **zéro coût serveur, zéro latence réseau, confidentialité totale du manuscrit** (le texte ne quitte jamais l'appareil de l'utilisateur pendant la génération). C'est cohérent avec le positionnement actuel de l'app (locale + sync optionnelle).
- Limite assumée : la qualité typographique fine (césure automatique multilingue, gestion stricte des veuves/orphelines au sens typographique strict) est plus difficile à obtenir sans un moteur de layout HTML/CSS complet. Voir section 4 et 12 pour la stratégie de contournement et la piste d'évolution V2.

---

## 3. Comparatif des approches techniques

| Bibliothèque | Fonctionnement | Pagination auto | Typographie fine | Signets/TOC natifs | Compatible export statique | Verdict |
|---|---|---|---|---|---|---|
| **Puppeteer / Playwright + Chromium** | Rend du vrai HTML/CSS en PDF (`page.pdf()`) | Excellente (moteur de layout complet, `@page`, `break-inside`, césure CSS) | Excellente (CSS `hyphens`, `widows`/`orphans`, `text-align: justify`) | Oui (via balises `<a>`/outline JS) | **Non** — nécessite Chromium serveur, absent de l'infra actuelle | Écarté pour la V1 ; piste V2 si une Cloud Function est ajoutée |
| **PDFKit** (usage Node classique) | API bas niveau de dessin (texte, formes) | Manuelle (il faut soi-même calculer les sauts de page) | Correcte mais tout est à coder à la main (pas de moteur de reflow) | Manuel | Existe un build navigateur, mais l'API reste bas niveau et le travail de mise en page manuel est considérable | Écarté : trop coûteux à développer pour un rendu « qualité livre » |
| **pdf-lib** | API bas niveau de manipulation/dessin de PDF, 100 % navigateur | Manuelle | Manuelle | Manuel (mais API d'outline existe) | **Oui** | Retenu **en complément** (post-traitement : fusion couverture, métadonnées, chiffrement), pas comme moteur de mise en page du texte |
| **jsPDF + html2canvas** | Capture un rendu HTML en image puis l'insère dans le PDF | Approximative (découpage d'image) | Mauvaise : le texte devient une image (non sélectionnable, non indexable, flou à l'impression, poids de fichier élevé) | Non | Oui | Écarté pour le corps du livre (perte de qualité rédhibitoire pour un usage impression/liseuse) ; envisageable uniquement pour un rendu de la couverture si besoin d'effets graphiques complexes |
| **@react-pdf/renderer** | Moteur de rendu déclaratif React → PDF, tourne dans le navigateur (et sur Node), reflow automatique du texte façon Yoga/Flexbox | Bonne (reflow automatique multi-pages) | Correcte (contrôle des marges, interlignage, retraits, styles par thème) mais pas de césure automatique ni de contrôle strict veuves/orphelines | **Natif** (`prop bookmark` sur composants → arbre de signets, TOC générable) | **Oui** | **Retenu comme moteur principal** |

### Choix retenu et justification

**@react-pdf/renderer** comme moteur de rendu du corps du livre :
- Cohérent avec la stack (React/TypeScript), donc réutilisable par toute l'équipe sans nouveau langage de template.
- Pagination automatique du texte (le composant `<Text>` se répartit sur plusieurs `<Page>` sans calcul manuel), ce qui est la difficulté principale d'un rendu « livre ».
- Signets PDF (table des matières navigable) et métadonnées PDF nativement supportés.
- Génère un PDF texte natif (sélectionnable, recherchable, léger) — essentiel pour la lecture sur liseuse/tablette et l'impression à la demande.
- S'exécute en Web Worker (l'API `@react-pdf/renderer` propose un rendu asynchrone non bloquant), ce qui permet d'afficher une barre de progression sans figer l'UI.

**pdf-lib** en complément, pour :
- Fusionner une image de couverture importée par l'utilisateur (haute résolution, contrôle exact du bleed/fond perdu) sans repasser par le moteur de layout texte.
- Ajouter/consolider les métadonnées PDF (titre, auteur, mots-clés) de façon garantie conforme à la norme.
- Étape future optionnelle : protection par mot de passe du PDF exporté.

**Limite typographique assumée pour la V1** : pas de césure automatique (hyphenation) ni de contrôle strict des veuves/orphelines au sens de l'imprimerie classique. Mitigation : choix de réglages par défaut prudents (interlignage généreux, retrait de première ligne plutôt que espace entre paragraphes, gouttières confortables) qui réduisent visuellement le problème sans le résoudre à 100 %. Documenté comme axe d'amélioration V2 (section 12).

---

## 4. Architecture proposée

Module indépendant, découplé du reste de l'application, avec une frontière d'import claire (le reste de l'app ne connaît que le point d'entrée `<ExportWizard />` et le hook `useExport()`).

```
src/features/export/
├── types/
│   ├── bookMeta.ts        # BookMetadata, CoverConfig, LegalInfo
│   ├── exportSettings.ts  # ExportFormat, ExportSettings, PageSetup
│   ├── theme.ts           # ExportTheme, ThemeTokens
│   └── job.ts             # ExportJob, ExportHistoryEntry
│
├── themes/
│   ├── registry.ts        # liste des thèmes disponibles + lookup
│   ├── classique.ts
│   ├── fantasy.ts
│   ├── polar-thriller.ts
│   ├── essai-biographie.ts
│   ├── jeunesse.ts
│   ├── minimaliste.ts
│   └── prestige.ts
│
├── fonts/
│   └── registerFonts.ts   # enregistrement des polices custom pour react-pdf
│
├── pdf/                   # composants @react-pdf/renderer (arbre du document)
│   ├── BookDocument.tsx   # assemble toutes les sections dans l'ordre éditorial
│   ├── CoverPage.tsx
│   ├── TitlePage.tsx
│   ├── CopyrightPage.tsx
│   ├── DedicacePage.tsx
│   ├── EpigraphPage.tsx
│   ├── FrontMatterPage.tsx  # préface / avant-propos / autres textes libres
│   ├── TableOfContents.tsx
│   ├── ChapterSection.tsx
│   ├── BackMatterPage.tsx   # postface / annexes / glossaire / bio / 4e de couverture
│   └── pageDecorations.tsx  # en-têtes, pieds de page, folios, ornements
│
├── services/
│   ├── generatePdf.ts     # orchestration : construit BookDocument, appelle react-pdf, puis pdf-lib
│   ├── mergeCover.ts       # pdf-lib : incruste l'image de couverture importée
│   ├── pdfMetadata.ts      # pdf-lib : titre/auteur/mots-clés/producteur
│   └── exportStorage.ts    # lecture/écriture Firestore des réglages & historique
│
├── hooks/
│   ├── useExportSettings.ts   # état des réglages (format, marges, thème...), persistance
│   ├── useCoverEditor.ts      # état de l'éditeur de couverture simple
│   └── useExportJob.ts        # lance la génération, expose progress/erreur/résultat
│
├── components/
│   ├── ExportWizard.tsx       # point d'entrée, orchestre les étapes
│   ├── steps/
│   │   ├── StepMetadata.tsx      # titre, sous-titre, auteur, pseudonyme, ISBN...
│   │   ├── StepFrontBackMatter.tsx # dédicace, remerciements, citation, textes libres
│   │   ├── StepCover.tsx         # import ou création de couverture
│   │   ├── StepTheme.tsx         # choix du thème graphique
│   │   ├── StepLayout.tsx        # format, marges, police, interligne
│   │   └── StepReview.tsx        # récapitulatif + bouton Générer
│   ├── CoverEditor/
│   │   ├── CoverCanvas.tsx       # aperçu live (SVG/HTML, pas le PDF final)
│   │   └── CoverControls.tsx     # fond, couleurs, typo, upload image
│   ├── PdfPreview.tsx         # aperçu paginé avant téléchargement (react-pdf <PDFViewer>)
│   ├── ExportProgress.tsx     # barre de progression + estimation
│   └── ExportHistoryPanel.tsx # liste des exports précédents, retélécharger/regénérer
│
└── utils/
    ├── linearizeManuscript.ts # EditableChapter[] → structure « livre » (retire les blocs vides, gère les types heading/quote)
    ├── wordCount.ts
    └── validation.ts          # ISBN check-digit, longueur champs, etc.
```

**Points d'intégration avec le code existant (minimaux, en lecture seule) :**
- `AtelierPage` / `EditorToolbar` : ajout d'une entrée « Exporter mon livre » qui ouvre `<ExportWizard manuscriptId={...} chapters={ms.chapters} />` (le module ne lit que `EditableChapter[]`, aucune dépendance inverse).
- `firestore.ts` : ajout de fonctions dédiées (`getExportSettings`, `saveExportSettings`, `addExportHistoryEntry`) plutôt que de modifier les fonctions existantes.
- Aucune modification des types `editor.ts` / `manuscript.ts` n'est nécessaire : le module d'export les consomme tels quels.

---

## 5. Modèle de données

### 5.1 Types (domaine export)

```ts
// types/bookMeta.ts
export interface BookMetadata {
  title: string;
  subtitle?: string;
  authorName: string;
  penName?: string;
  epigraph?: string;          // citation d'ouverture
  dedication?: string;
  acknowledgments?: string;
  backCoverBlurb?: string;    // 4e de couverture
  isbn?: string;
  publisher?: string;
  publisherLogoUrl?: string;
  copyrightYear?: number;
  legalNotice?: string;
  authorBio?: string;
}

// Sections de texte libre, en nombre variable et réordonnables
// (remplace les champs dédiés préface/avant-propos/postface : un seul mécanisme générique)
export interface FrontBackMatterSection {
  id: string;
  placement: 'front' | 'back';   // avant ou après les chapitres
  kind: 'preface' | 'foreword' | 'afterword' | 'appendix' | 'glossary' | 'custom';
  title: string;
  content: string;               // markdown simple (gras/italique/paragraphes)
  order: number;
}

export interface CoverConfig {
  mode: 'imported' | 'generated' | 'none';
  imageUrl?: string;          // Firebase Storage, si mode = imported
  background?: { type: 'color' | 'gradient'; value: string };
  titleColor?: string;
  fontFamily?: string;
  illustrationUrl?: string;   // si mode = generated, illustration optionnelle
  // Champ réservé, inactif par défaut (feature flag) : voir mise à jour section 12.1
  // Si activé, ne pas appeler Imagen directement depuis ce module — passer par
  // src/services/ai-router/services/coverGeneration.ts (Lot F du plan de routage IA),
  // qui gère la chaîne de repli et le quota partagé avec le reste de l'app.
  aiGeneration?: { prompt: string; provider: 'imagen-4' } | null;
}
```

```ts
// types/exportSettings.ts
export type PageFormat = 'A4' | 'A5' | '6x9in' | 'pocket';
export type ThemeId = 'classique' | 'fantasy' | 'sf' | 'polar' | 'thriller'
  | 'essai' | 'biographie' | 'jeunesse' | 'minimaliste' | 'prestige';

export interface PageSetup {
  format: PageFormat;
  orientation: 'portrait' | 'landscape';
  marginTopMm: number;
  marginBottomMm: number;
  marginInsideMm: number;   // marge intérieure (reliure) — plus grande que l'extérieure
  marginOutsideMm: number;
  bleedMm: number;          // fonds perdus, pour impression POD
  fontSizePt: number;
  lineHeight: number;
  firstLineIndentMm: number;
  justify: boolean;
}

export interface ExportSettings {
  id: string;
  themeId: ThemeId;
  page: PageSetup;
  includeToc: boolean;
  includeChapterNumbers: boolean;
  startNewPagePerChapter: boolean;
  updatedAt: number;
}
```

```ts
// types/job.ts
export interface ExportJob {
  status: 'idle' | 'preparing' | 'rendering' | 'merging-cover' | 'done' | 'error';
  progress: number;        // 0–100, estimé (nombre de chapitres traités / total)
  error?: string;
  resultBlobUrl?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface ExportHistoryEntry {
  id: string;
  createdAt: number;
  title: string;
  themeId: ThemeId;
  pageFormat: PageFormat;
  wordCount: number;
  // Le fichier PDF lui-même n'est PAS conservé côté serveur (confidentialité + coût) :
  // seul l'historique des paramètres est gardé pour permettre une régénération à l'identique.
}
```

### 5.2 Stockage Firestore (extension, aucune rupture avec l'existant)

```
users/{uid}/manuscripts/{manuscriptId}/
  meta/exportSettings        → ExportSettings (dernier réglage utilisé, un seul document)
  meta/bookMetadata          → BookMetadata + FrontBackMatterSection[] + CoverConfig
  exportHistory/{entryId}    → ExportHistoryEntry (sous-collection, historique borné aux ~20 derniers)
```

Ces documents suivent exactement le même schéma d'accès que `meta/notes` déjà en place (`isOwner(userId) && isValidPayload()`), donc **aucune modification des `firestore.rules` n'est nécessaire**, sous réserve de créer explicitement la règle pour la nouvelle sous-collection `exportHistory` (ajout d'un bloc `match /exportHistory/{entryId} { ... }` identique aux autres, par simple copier-coller du modèle `chapters`).

Les images de couverture sont stockées sous `users/{uid}/covers/{manuscriptId}/{fileId}.jpg`, ce qui rentre déjà dans la règle Storage existante (`users/{userId}/**`, images ≤ 10 Mo) — **aucune modification de `storage.rules` nécessaire**.

Persistance locale (`localStorage`) en miroir, même pattern que `useManuscript`, pour un fonctionnement hors-ligne cohérent avec le reste de l'app.

---

## 6. Système de thèmes graphiques

Chaque thème est un objet de configuration pur (pas de composant dupliqué par thème) :

```ts
export interface ExportTheme {
  id: ThemeId;
  label: string;
  fonts: { heading: string; body: string; folio: string };
  colors: { text: string; accent: string; ruleLine: string };
  chapterOpening: 'drop-cap' | 'centered-number' | 'ornament' | 'plain';
  headerStyle: 'author-title-alternating' | 'title-only' | 'none';
  folioStyle: 'centered' | 'outer-corner' | 'none';
  ornamentGlyph?: string;     // séparateur de scène, ex. « ❦ », « ✦ »
  titlePageLayout: 'centered' | 'left-aligned' | 'framed';
}
```

Les composants `pdf/*.tsx` lisent uniquement ce jeu de tokens (jamais de `if (themeId === ...)` dispersés dans les composants) — un nouveau thème s'ajoute en créant un seul fichier `themes/xxx.ts`, sans toucher au moteur de rendu. Les 10 thèmes demandés (roman classique, fantasy, SF, policier, thriller, essai, biographie, jeunesse, minimaliste, prestige) rentrent dans cette même structure ; certains proches (policier/thriller, essai/biographie) peuvent partager la même config avec un seul paramètre différent, pour éviter la duplication.

---

## 7. Flux utilisateur

### 7.1 Assistant de préparation (wizard, toutes étapes facultatives sauf le titre)

1. **Métadonnées principales** — titre*, sous-titre, auteur*/pseudonyme, ISBN, éditeur + logo, copyright/année, mentions légales. (*pré-rempli depuis le manuscrit/profil existant)
2. **Textes complémentaires** — citation d'ouverture, dédicace, remerciements, et un éditeur de « sections » génériques réordonnables (préface, avant-propos, postface, annexes, glossaire, biographie, 4e de couverture) — chacune ajoutable/supprimable à la demande plutôt que 6 champs fixes toujours affichés.
3. **Couverture** — importer une image, ou créer une couverture simple (fond/couleur/typo/titre/illustration optionnelle), aperçu live en HTML/SVG (pas de rendu PDF à cette étape, pour la réactivité).
4. **Thème graphique** — galerie des 10 thèmes avec vignette de prévisualisation.
5. **Mise en page** — format (A4/A5/6×9/poche), orientation, marges, fond perdu, police/corps/interligne, sommaire oui/non, saut de page par chapitre oui/non.
6. **Récapitulatif & génération** — aperçu paginé (`PdfPreview`, rendu react-pdf réel, quelques pages représentatives pour rester rapide), bouton « Générer le PDF complet », barre de progression avec estimation (basée sur nombre de mots/chapitres traités), téléchargement, puis entrée ajoutée à l'historique.

Les réglages sont sauvegardés à chaque étape (debounce identique au pattern `useManuscript`) : l'utilisateur peut fermer l'assistant et le rouvrir sans perdre son travail de préparation.

### 7.2 Régénération rapide

Depuis `ExportHistoryPanel`, un bouton « Régénérer avec ces réglages » saute directement à l'étape 6 avec les paramètres de l'entrée choisie, en relisant l'état courant du manuscrit (donc incluant les modifications faites depuis le dernier export).

### 7.3 Gestion des erreurs

- Erreur de rendu (police manquante, image de couverture corrompue) → message contextualisé + possibilité de continuer sans couverture / avec police de secours.
- Manuscrit vide ou chapitre sans contenu → avertissement non bloquant avant génération.
- Échec silencieux impossible : `ExportJob.status = 'error'` toujours accompagné d'un message actionnable.

---

## 8. Fonctionnalités avancées retenues pour la V1

- Sommaire automatique (généré depuis les titres de chapitres + sections front/back matter).
- Signets PDF hiérarchiques (`bookmark` de `@react-pdf/renderer`, un niveau pages liminaires + un niveau par chapitre).
- Métadonnées PDF standard (titre, auteur, mots-clés, logiciel producteur) via `pdf-lib`.
- Liens internes (sommaire → chapitre, appels de note → note en fin de chapitre ou en fin d'ouvrage selon le thème).
- Numérotation de page (folio) et en-têtes courants configurables par thème.
- Numérotation des chapitres, optionnelle.

Écarté explicitement de la V1 (voir section 12) : recherche plein texte dans le PDF généré (déjà native à tout lecteur PDF sérieux, ne nécessite aucun développement de notre part), liens externes cliquables généralisés (utile seulement pour de rares cas, ajoutable en 5 lignes plus tard si demandé).

---

## 9. Expérience utilisateur — au-delà du strict export

- Historique des exports (dates, réglages, mais **pas** de conservation du fichier binaire — confidentialité et coût de stockage) avec régénération en un clic.
- Sauvegarde automatique des préférences (thème et mise en page par défaut réutilisés au prochain export).
- Barre de progression avec estimation du temps restant, calculée simplement (mots traités / débit moyen mesuré sur les premiers chapitres du même export, pas de constante arbitraire).
- Aperçu avant génération complète (bascule automatique en mode « aperçu rapide », qui ne rend que les 3 premières pages significatives, pour éviter d'attendre le rendu complet à chaque réglage modifié).

---

## 10. Plan d'implémentation — lots indépendants pour parallélisation

Découpage pensé pour que plusieurs agents (ou développeurs) travaillent **simultanément sans conflit de fichiers**, en s'appuyant sur des interfaces TypeScript figées dès le lot 0.

**Lot 0 — Contrats (bloquant, doit être fait en premier, ~1 fichier par domaine)**
Créer uniquement `types/*.ts` (section 5) et `themes/registry.ts` (interface `ExportTheme` vide de contenu). Aucune logique. Ce lot doit être mergé avant que les autres démarrent, car tous les lots suivants importent ces types sans les modifier.

Une fois le Lot 0 posé, les lots suivants sont indépendants entre eux (aucun ne modifie les fichiers d'un autre) :

- **Lot A — Moteur de rendu PDF**
  `pdf/*.tsx`, `fonts/registerFonts.ts`, `services/generatePdf.ts`, `services/mergeCover.ts`, `services/pdfMetadata.ts`, `utils/linearizeManuscript.ts`.
  Livrable testable seul : une fonction `generatePdf(chapters, metadata, settings, theme) → Blob`, testée avec des données factices, sans dépendre de l'UI.

- **Lot B — Thèmes graphiques**
  Contenu de `themes/*.ts` (les 10 thèmes). Dépend uniquement de l'interface `ExportTheme` du Lot 0. Peut être livré thème par thème.

- **Lot C — Assistant de préparation (wizard) UI**
  `components/ExportWizard.tsx` + `components/steps/*`. Consomme les types du Lot 0, produit un objet `{ metadata, coverConfig, settings }` — peut être développé avec des données mockées, sans attendre le Lot A.

- **Lot D — Éditeur de couverture simple**
  `components/CoverEditor/*`, `hooks/useCoverEditor.ts`. Autonome, rendu en HTML/SVG (pas de dépendance à react-pdf), s'intègre au Lot C via une simple prop `onChange(CoverConfig)`. Le mode `import`/`création manuelle` (fond, couleurs, typo) ne dépend de rien d'autre et peut être livré seul. Le mode `aiGeneration` (facultatif, désactivé par défaut derrière un flag) dépend du Lot F du plan de routage IA (`services/coverGeneration.ts`) — à ne développer qu'une fois ce service disponible, pas avant.

- **Lot E — Persistance & historique**
  `services/exportStorage.ts`, `hooks/useExportSettings.ts`, `components/ExportHistoryPanel.tsx`, ainsi que l'ajout du bloc de règles `exportHistory` dans `firestore.rules`. Dépend seulement des types du Lot 0.

- **Lot F — Orchestration & progression**
  `hooks/useExportJob.ts`, `components/ExportProgress.tsx`, `components/PdfPreview.tsx`. C'est le seul lot qui assemble A + C + E ensemble — à faire en dernier, une fois les lots précédents disponibles (même en version minimale/mockée).

- **Lot G — Tests**
  `__tests__/` dédiés au module (linéarisation du manuscrit, validation ISBN, rendu du moteur avec un manuscrit de test). Peut démarrer dès le Lot 0 en écrivant les tests contre les interfaces avant l'implémentation (TDD), en parallèle de tous les autres lots.

- **Lot H — Intégration finale**
  Un seul point de couture dans le code existant : ajout du bouton d'entrée dans `EditorToolbar.tsx` / `AtelierPage.tsx` qui ouvre `<ExportWizard />`. Volontairement isolé en dernier lot pour ne jamais être une source de conflit avec le reste des lots.

---

## 11. Maquettes des écrans (description fonctionnelle)

- **Point d'entrée** : bouton « Exporter mon livre » dans la barre d'outils de l'atelier, à côté des actions existantes (undo/redo, focus mode).
- **Wizard** : modale plein écran, colonne de gauche = liste des 6 étapes (cochées au fur et à mesure, navigables librement, aucune étape bloquante hormis le titre), zone centrale = formulaire de l'étape courante, zone de droite (dès l'étape couverture) = aperçu live qui se met à jour à chaque étape suivante (couverture → thème → mise en page).
- **Étape récapitulative** : aperçu paginé à gauche (rendu réel via `<PDFViewer>` de react-pdf, redimensionné), résumé des choix à droite, bouton d'action principal en bas.
- **Historique** : liste chronologique, chaque entrée = titre + date + thème + format + bouton « Régénérer ».

*(Ces écrans peuvent être maquettés en aperçu interactif si vous le souhaitez — je peux générer un prototype HTML de l'assistant pour validation avant le développement.)*

---

## 12. Ce que je choisis de ne pas développer maintenant, et pourquoi

- **Générateur de couverture par IA** : l'architecture prévoit le champ `CoverConfig.aiGeneration` pour ne pas bloquer une future intégration, mais je ne le développe pas maintenant — cela suppose un choix de fournisseur, une gestion de coût/quota, et un consentement explicite sur l'usage de contenu généré en couverture d'un livre. Sujet à traiter séparément.

### 12.1 Mise à jour — chiffres de quota réels (post-audit du dashboard)

Le fournisseur retenu si cette fonctionnalité est activée serait **Imagen 4** (déjà disponible sur le projet Firebase/Gemini de l'application). Quota réel confirmé : **25 générations/jour par variante** (Fast / Generate / Ultra), soit **75/jour au total** en chaînant les trois — partagé entre tous les auteurs de l'app, comme tout le reste des quotas IA (voir le constat n°1 du plan de routage).

Ce chiffre change l'arbitrage : 75/jour est confortable pour un usage ponctuel (une couverture par livre exporté, pas par régénération de brouillon), mais insuffisant si la fonctionnalité invite à itérer librement sur plusieurs propositions par utilisateur. Recommandation si le sujet est repris : limiter à un nombre de générations par manuscrit (ex. 3 essais), pas par session, pour répartir ce quota partagé équitablement entre auteurs.

**Point d'architecture important** : ce module d'export ne doit **pas** implémenter sa propre logique d'appel Imagen ni son propre suivi de quota. Un chantier parallèle (« Plan d'action — routage de modèles IA », document séparé) construit un routeur de modèles centralisé, conscient des quotas réels par modèle, dont un des lots (Lot F) est justement `services/coverGeneration.ts`. Si la génération de couverture par IA est un jour activée, le Lot D de ce module (éditeur de couverture, section 10) doit simplement appeler ce service partagé plutôt que dupliquer la gestion de chaîne de repli/quota — d'où la dépendance désormais explicite dans le type `CoverConfig.aiGeneration` (section 5.1).
- **Champs dédiés préface/avant-propos/postface/annexes/glossaire/biographie/4e de couverture en 7 formulaires distincts** : remplacés par le mécanisme générique `FrontBackMatterSection[]` (section 5.1), plus simple à maintenir, tout aussi complet pour l'utrice/utilisateur, et qui absorbe naturellement l'ajout futur d'autres types de sections sans modification de schéma.
- **Rendu Puppeteer/Chromium (typographie éditoriale stricte : césure, veuves/orphelines fines)** : nécessite l'ajout d'une Cloud Function, donc une rupture avec le modèle 100 % statique actuel. Je le documente comme piste V2 plutôt que de l'implémenter, pour ne pas complexifier l'infrastructure sans validation préalable de votre part.
- **Chiffrement / mot de passe du PDF exporté** : possible techniquement via `pdf-lib`, mais absent de la demande initiale et non prioritaire ; ajoutable en une fonction isolée dans `services/pdfMetadata.ts` si besoin exprimé plus tard.
- **Validation ISBN avec vérification en ligne auprès d'un registre** : je ne fais qu'une validation locale du format et de la clé de contrôle (l'ISBN reste une donnée déclarative de l'auteur, pas une vérification d'authenticité — ce n'est pas le rôle de l'application).

---

## 13. Prochaines étapes proposées

1. Validation de ce document (arbitrages section 12 en particulier).
2. Lot 0 (contrats de types) — court, à faire valider avant de lancer les lots en parallèle.
3. Démarrage des lots A à G en parallèle.
4. Lot F puis H en fin de cycle.

Je reste à disposition pour commencer directement l'implémentation du Lot 0 et du Lot A (le plus structurant techniquement) si vous validez cette direction.
