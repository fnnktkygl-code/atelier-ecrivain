import { NextResponse } from 'next/server';

function enhancePromptForAI(frenchPrompt: string): string {
  let p = frenchPrompt.toLowerCase();

  const map: Record<string, string> = {
    'ombre': 'shadow',
    'humaine': 'human',
    'humain': 'human',
    'peindre': 'paint',
    'dieu': 'god',
    'image': 'image',
    'tente de': 'trying to',
    'livre': 'book',
    'couverture': 'cover',
    'sombre': 'dark',
    'ciel': 'sky',
    'étoiles': 'stars',
    'étoile': 'star',
    'forêt': 'forest',
    'château': 'castle',
    'homme': 'man',
    'femme': 'woman',
    'visage': 'face',
    'lumière': 'light',
    'dieu à son image': 'god in human image',
  };

  let translated = p;
  Object.keys(map).forEach((fr) => {
    translated = translated.replace(new RegExp(`\\b${fr}\\b`, 'gi'), map[fr]);
  });

  return `${translated}, cinematic book cover artwork, highly detailed digital painting, dramatic lighting, masterpiece, 8k resolution`;
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt requis' }, { status: 400 });
    }

    const enhancedPrompt = enhancePromptForAI(prompt.trim());
    const seed = Math.floor(Math.random() * 1000000);

    // Try Flux AI model first via Pollinations server-side
    const urls = [
      `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=600&height=900&model=flux&nologo=true&seed=${seed}`,
      `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=600&height=900&nologo=true&seed=${seed}`,
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?width=600&height=900&nologo=true&seed=${seed}`,
    ];

    let lastError = null;
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer.byteLength > 1000) {
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const contentType = res.headers.get('content-type') || 'image/jpeg';
            const dataUrl = `data:${contentType};base64,${base64}`;
            return NextResponse.json({ dataUrl });
          }
        }
      } catch (err: any) {
        lastError = err;
        console.warn('AI provider retry:', url, err?.message);
      }
    }

    throw lastError || new Error('Erreur de génération d\'image');
  } catch (err: any) {
    console.error('API Generate Cover Error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur lors de la génération server-side' }, { status: 500 });
  }
}
