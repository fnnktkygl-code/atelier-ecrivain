import { selectModel } from '../router/selectModel';

export interface DictationModelSelection {
  modelId: string;
  degraded: boolean;
}

export async function getDictationModel(): Promise<DictationModelSelection> {
  const selection = await selectModel('dictation');
  return {
    modelId: selection.modelId || 'gemini-2.5-flash',
    degraded: selection.degraded,
  };
}
