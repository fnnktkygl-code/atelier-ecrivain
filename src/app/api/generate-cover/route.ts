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
  };

  let translated = p;
  Object.keys(map).forEach((fr) => {
    translated = translated.replace(new RegExp(`\\b${fr}\\b`, 'gi'), map[fr]);
  });

  return `${translated}, cinematic book cover artwork, highly detailed digital painting, dramatic lighting, masterpiece, 8k resolution`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = body?.prompt || 'Book cover illustration';

    const enhancedPrompt = enhancePromptForAI(prompt.trim());
    const seed = Math.floor(Math.random() * 1000000);

    const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=600&height=900&model=flux&nologo=true&seed=${seed}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(aiUrl, {
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
        return NextResponse.json({ dataUrl: `data:${contentType};base64,${base64}` });
      }
    }

    return NextResponse.json({ dataUrl: aiUrl });
  } catch (err: any) {
    console.error('API Generate Cover Error:', err);
    const seed = Math.floor(Math.random() * 1000000);
    const fallbackUrl = `https://image.pollinations.ai/prompt/book%20cover%20artwork?width=600&height=900&nologo=true&seed=${seed}`;
    return NextResponse.json({ dataUrl: fallbackUrl });
  }
}
