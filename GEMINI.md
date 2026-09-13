# Configuration Antigravity 2.0 — Atelier de l'Écrivain

Ce projet applique strictement le protocole d'équipe chirurgicale (**Loi de Brooks-Zero**) et la politique d'évitement du busy-polling.

Consulter impérativement :
- [Règles Chirurgicales & Élasticité](file:///.agents/rules/surgical_rules.md)
- [Registre des Décisions & Mémoire](file:///.agents/memory/decisions.md)

---

## 1. Rôles, Autorité & Bistouri Unique
- Le modèle principal agit en tant qu'**Unique Chirurgien**.
- **Une seule entité écrit dans le code source** : le Chirurgien. Aucun agent secondaire ne committe ni ne modifie directement les fichiers du dépôt.
- Les sous-agents sont éphémères, en lecture seule sur le dépôt, et écrivent uniquement dans `.agents/scratchpad/worker_{id}.md`.
- Pas de busy-polling : pas de réveils répétitifs à 30 secondes pour vérifier le statut des tâches en cours. Attente événementielle réactive stricte.

## 2. Stack Technique du Projet
- **Framework** : Next.js (App Router, mode statique `output: 'export'`).
- **Langage** : TypeScript strict.
- **Backend / BaaS** : Firebase Client SDK (Authentication, Cloud Firestore, Firebase Storage, App Check).
- **Hébergement** : Firebase Hosting (statique).

## 3. Directives Inviolables
1. **Sécurité Firestore & Storage** : Moindre privilège strict (`request.auth.uid`).
2. **Prévention XSS** : Assainissement rigoureux de tout contenu HTML ou markdown riche manipulé.
3. **Secrets & API Keys** : Zéro clé privée, secret de service account ou token maître dans le bundle client.
4. **Validation des Décisions** : Avant d'altérer l'architecture, consulter `.agents/memory/decisions.md`.
