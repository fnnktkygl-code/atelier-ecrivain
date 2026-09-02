import { getGeminiAIStudio, formatGeminiError } from '@/services/ai/geminiClient';
import { selectModel } from '../router/selectModel';
import { recordUsage } from '../router/recordUsage';
import { FEATURE_CHAINS } from '../types/featureChains';

export interface DeepResearchResult {
  topic: string;
  summary: string;
  keyPoints: string[];
  sources: Array<{ title: string; uri?: string }>;
  fullReport: string;
  modelUsed?: string;
}

export interface DeepResearchCandidateWithGrounding {
  groundingMetadata?: {
    groundingChunks?: Array<{
      web?: {
        uri?: string;
        title?: string;
      };
    }>;
  };
}

const SYSTEM_PROMPT_DEEP_RESEARCH = `Tu es un archiviste et chercheur documentaire de haut niveau pour auteurs et écrivains.
On te donne un sujet ou une question de recherche (historique, religieuse, géographique, scientifique, littéraire ou biographique).
Tu dois produire un dossier documentaire rigoureux, sourcé et immédiatement exploitable pour enrichir un manuscrit.

Format de sortie : tu dois répondre avec un contenu clair, structuré avec les sections suivantes :
1. Résumé exécutif (2-3 phrases clés)
2. Faits & Éléments essentiels (points à puces avec dates, lieux, protagonistes)
3. Contexte d'époque & détails sensoriels (pour aider la narration)
4. Sources & références vérifiables`;

export async function performDeepResearch(
  query: string,
  context?: { currentChapterTitle?: string; manuscriptContext?: string }
): Promise<DeepResearchResult> {
  const genAI = getGeminiAIStudio();
  const selection = await selectModel('deep-research');
  const chain = selection.modelId
    ? [selection.modelId, ...FEATURE_CHAINS['deep-research'].chain.filter((m) => m !== selection.modelId)]
    : FEATURE_CHAINS['deep-research'].chain;

  let prompt = `Sujet de recherche : ${query}`;
  if (context?.currentChapterTitle) {
    prompt += `\nContexte du chapitre en cours : ${context.currentChapterTitle}`;
  }
  if (context?.manuscriptContext) {
    prompt += `\nExtrait du texte de référence : « ${context.manuscriptContext.slice(-800)} »`;
  }

  let lastError: unknown = null;

  for (const modelName of chain) {
    try {
      const isSearchModel = modelName.includes('deep-research') || modelName.includes('flash') || modelName.includes('pro');
      const model = genAI.getGenerativeModel({
        model: modelName,
        tools: isSearchModel ? ([{ googleSearch: {} }] as never) : undefined,
        generationConfig: {
          maxOutputTokens: 8192,
        } as never,
        systemInstruction: SYSTEM_PROMPT_DEEP_RESEARCH,
      });

      const response = await model.generateContent(prompt);
      await recordUsage(modelName, 'generation', 'success');

      const fullText = response.response.text();
      const candidate = response.response.candidates?.[0] as DeepResearchCandidateWithGrounding | undefined;
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];

      const sources = groundingChunks
        .map((c) => ({
          title: c.web?.title || c.web?.uri || 'Source Web',
          uri: c.web?.uri,
        }))
        .filter((s) => Boolean(s.title));

      // Extract brief summary
      const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean);
      const summary = lines.find((l) => !l.startsWith('#')) || fullText.slice(0, 200);

      // Extract bullet points
      const keyPoints = lines
        .filter((l) => l.startsWith('- ') || l.startsWith('* ') || /^\d+\.\s/.test(l))
        .map((l) => l.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''))
        .slice(0, 8);

      return {
        topic: query,
        summary,
        keyPoints: keyPoints.length > 0 ? keyPoints : [summary],
        sources,
        fullReport: fullText,
        modelUsed: modelName,
      };
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('Quota exceeded')
      ) {
        await recordUsage(modelName, 'generation', 'quota-error');
      }
      continue;
    }
  }

  throw new Error(formatGeminiError(lastError || 'Échec de la recherche documentaire approfondie.'));
}
