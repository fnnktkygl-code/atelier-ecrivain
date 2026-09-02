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
