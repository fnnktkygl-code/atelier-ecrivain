/**
 * Google Gemini AI Studio Client
 * 
 * Direct connection to Google AI Studio API (generativelanguage.googleapis.com)
 * using the official @google/generative-ai SDK.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export function getGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    const userKey = localStorage.getItem('atelier_user_gemini_key');
    if (userKey && userKey.trim().length > 0) {
      return userKey.trim();
    }
  }

  const envKey =
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    '';

  return envKey.trim();
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey().length > 0;
}

let cachedClient: GoogleGenerativeAI | null = null;
let lastKeyUsed: string = '';

export function getGeminiAIStudio(): GoogleGenerativeAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Clé API Gemini AI Studio non configurée. Définissez NEXT_PUBLIC_GEMINI_API_KEY ou entrez votre clé dans l'application."
    );
  }

  if (!cachedClient || lastKeyUsed !== apiKey) {
    cachedClient = new GoogleGenerativeAI(apiKey);
    lastKeyUsed = apiKey;
  }

  return cachedClient;
}

export function formatGeminiError(err: unknown): string {
  if (!err) return 'Une erreur inconnue est survenue avec le service Gemini.';
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes('API_KEY_SERVICE_BLOCKED') || (msg.includes('403') && msg.includes('blocked'))) {
    return "Clé API restreinte ou non autorisée pour Gemini. Veuillez configurer votre clé Google AI Studio dans le menu Profil ou vérifier les restrictions d'API sur Google Cloud.";
  }

  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    return 'Clé API Gemini invalide. Veuillez vérifier la clé configurée dans Profil & Paramètres.';
  }

  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.includes('Quota exceeded')) {
    return 'Quota Gemini temporairement atteint pour ce modèle. Réessayez dans quelques secondes.';
  }

  if (msg.includes('SAFETY')) {
    return 'Le contenu a été bloqué par les filtres de sécurité Google Gemini.';
  }

  // If it's a JSON-wrapped GoogleGenerativeAI Error, extract cleanly if possible
  const jsonMatch = msg.match(/\[4\d\d\]\s*(.*)/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed[0]?.message) return parsed[0].message;
    } catch {
      // ignore
    }
  }

  return msg;
}
