# Registre des Décisions & Mémoire Commune (Atelier de l'Écrivain)

Ce registre consigne les choix structurants d'architecture, les conventions techniques et les arbitrages pour éviter toute régression ou dérive de contexte.

---

### Modèle d'entrée :
- **Date** : AAAA-MM-JJ
- **Domaine** : [Architecture | Sécurité | Modélisation | Sync]
- **Problème / Contexte** : Situation nécessitant un arbitrage.
- **Décision tranchée** : Règle ou choix technique adopté.
- **Raison & Rationale** : Pourquoi cette solution a été retenue et contre-exemples écartés.

---

## Décisions Actées

### 2026-09-11 | Architecture des Agents & Consommation de Tokens
- **Problème** : Risque d'inflation de contexte et gaspillage de quota via des boucles de polling intempestives (incident Astra/Luna : 47 sondages inutiles = 7,1M tokens consommés) et conflits de merge multi-agents (loi de Brooks).
- **Décision tranchée** : Adoption du protocole Brooks-Zero :
  1. Le Lead Agent est le **Chirurgien Unique** (seul habilité à modifier le code source).
  2. Les sous-agents sont éphémères, en lecture seule, plafonnés à 2 maximum, et communiquent via `.agents/scratchpad/`.
  3. Interdiction absolue du busy-polling : attente d'événements réactifs, pas de requêtes de statut en boucle courte.
- **Raison** : Maîtrise prédictive des coûts en tokens et préservation de la cohérence logique du codebase.

### 2026-09-11 | Architecture Frontend & Déploiement Statique
- **Problème** : Déploiement statique Next.js App Router couplé à Firebase sans serveur Node dédié (`output: 'export'`).
- **Décision tranchée** :
  1. Toute la logique d'état et d'accès aux données s'exécute côté client (React hooks, contextes, Firebase Web SDK).
  2. Aucune API route dynamique (`/api/*`) dépendant d'un runtime serveur Node.js dans le bundle statique.
- **Raison** : Hébergement ultra-léger, résilient, sécurisé et totalement découplé.

### 2026-09-11 | Directives de Sécurité Firebase & XSS
- **Problème** : Risques d'exfiltration de données, d'écrasement de manuscrits tiers et d'injection de code malveillant dans les contenus d'écriture enrichie.
- **Décision tranchée** :
  1. Moindre privilège strict dans `firestore.rules` et `storage.rules` (vérification systématique de `request.auth.uid == userId`).
  2. Échappement et assainissement systématique de tout contenu HTML injecté dynamiquement.
  3. Zéro secret ou token de compte de service dans le bundle client.
- **Raison** : Protection absolue de l'intégrité et de la confidentialité des œuvres des écrivains.

### 2026-09-11 | Dictée Vocale Mobile & Décodage STT Gemini
- **Problème** : La dictée audio ne fonctionnait pas sur mobile (Safari iOS / Android) : blocage micro par conflit de session audio (`LiveSpeechRecognizer`), corruption des chunks MP4 par `start(1000)` sur WebKit, rejet par contraintes `sampleRate` et réponse vide sur `gemini-3.5-transcribe` (`audioTranscription.text` non lu par le SDK).
- **Décision tranchée** :
  1. Extraction STT universelle : support de `part.audioTranscription.text` (Gemini 3.5 Transcribe) et `part.text` (Gemini 3.6/3.7 Flash) avec fallback si réponse vide.
  2. Détection binaire du MIME type par magic bytes (`ftyp` pour MP4, `1A 45 DF A3` pour WebM, `RIFF` pour WAV) pour fiabiliser l'ingestion multimodale.
  3. Suppression du timeslice sur Safari/MP4 dans `AudioRecorder` (génération d'un conteneur intègre à l'arrêt).
  4. Isolation du microphone sur mobile : désactivation de la reconnaissance locale concurrente pour préserver l'accès exclusif d'`AVAudioSession`.

### 2026-09-11 | Ergonomie Mobile & Atelier « En Trajet » (Japandi UI)
- **Problème** : L'interface de l'Atelier était conçue pour le confort de bureau mais manquait d'ergonomie à une main sur smartphone (difficulté d'accéder aux chapitres sans ouvrir un grand tiroir, ajout de paragraphe fastidieux, bouton de dictée enfoui ou mal adapté aux micro-moments de trajet).
- **Décision tranchée** :
  1. Introduction d'une barre tactile basse (`MobileBottomBar`) optimisée pour le pouce (zone inférieure à portée directe), n'apparaissant que sur mobile (`<= 900px`).
  2. FAB de dictée tactile centrale (58px) avec transition fluide vers le dock d'enregistrement (pulsation terracotta, timer lisible, grand bouton d'arrêt 48px, pause/annulation, retour visuel IA immédiat).
  3. Sélecteur rapide de chapitre intégré avec bouton `+ Ch` immédiat.
  4. Bouton d'ajout de paragraphe en 1 tap (`+ Bloc`) dans la barre basse et barres d'insertion contextuelles (`.editor-append-bar` et inter-blocs tactiles) avec cibles tactiles WCAG 2.2 AAA (>= 44px).
  5. Masquage propre du dock flottant desktop sur mobile pour éviter toute superposition ou encombrement de l'écran.
- **Raison** : Offrir aux écrivains une expérience de saisie nomade fluide, naturelle et zen pendant les trajets quotidiens.

### 2026-09-13 | Dictée Vocale Mobile WYSIWYG & Correction Événementielle Tactile
- **Problème** : Sur mobile (iOS/Android), le tap sur l'icône de dictée fermait le clavier, sortait l'utilisateur du paragraphe et ne transcrivait rien en temps réel. Causes identifiées : (1) `onTouchStart` avec `preventDefault()` bloquait l'événement W3C `click` sur écran tactile ; (2) Conflit de capture microphone matériel (`getUserMedia` préemptait `webkitSpeechRecognition`) ; (3) Déconnexion visuelle : la transcription s'affichait dans une boîte externe sous le bloc au lieu de s'inscrire directement dans le texte ; (4) Perte du bloc actif lors du blur.
- **Décision tranchée** :
  1. **Purge des `preventDefault` tactiles** : Suppression des `onTouchStart` parasites sur les boutons d'action et la FAB mobile pour garantir le déclenchement standard du `click` et préserver le focus.
  2. **Streaming WYSIWYG In-Situ** : Les mots prononcés s'affichent en temps réel directement à l'intérieur du paragraphe actif (`.editor-block-content` avec `.dictation-inline-zone` et curseur terracotta clignotant), sans boîte flottante déconnectée.
  3. **Mémorisation du Bloc Actif** : Préservation de la cible via `lastFocusedBlockIdRef` dans `AtelierPage` pour garantir que la dictée s'injecte exactement dans le paragraphe édité, même si le clavier virtuel se rétracte.
  4. **Exclusivité Audio Session** : Séparation stricte des pipelines. Si `LiveSpeechRecognizer.isSupported()` est vrai, il prend le contrôle exclusif du micro (aucun `getUserMedia` concurrent). À l'arrêt, le texte transcrit est injecté immédiatement dans le paragraphe, puis magnifié en tâche de fond par Gemini sans blocage UI.
  5. **Détection Secure Context** : Vérification de `window.isSecureContext` et message explicite si l'accès se fait via HTTP LAN (`http://192.168.x.x`) qui désactive le Web Speech API sur les navigateurs mobiles.
- **Raison** : Rétablir une dictée vocale instantanée, fidèle et ergonomique pour l'écriture nomade sur smartphone.

