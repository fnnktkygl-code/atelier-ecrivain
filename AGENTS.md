# Instructions & Directives — Atelier de l'Écrivain

- **Stack Technique** : Next.js (App Router, Export Statique `output: 'export'`), React, TypeScript strict, Firebase (Auth, Firestore, Storage, App Check).
- **Directives de Sécurité** :
  1. Respecter strictement la moindre privilège sur les règles de sécurité Firestore (`firestore.rules`) et Storage (`storage.rules`).
  2. Systématiquement assainir et échapper le contenu HTML dynamique (prévention XSS).
  3. Aucune clé d'API privée ni secret de service account ne doit être présent dans le code bundle client.
