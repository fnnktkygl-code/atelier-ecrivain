import { NextResponse } from 'next/server';

const THEME_PHOTO_IDS: Record<string, string[]> = {
  god: ['1579783900882-c0d3dad7b119', '1518709268805-4e9042af9f23', '1534447677768-be436bb09401'],
  shadow: ['1509198397868-475647b2a1e5', '1514539079130-25950c84af65', '1518709268805-4e9042af9f23'],
  paint: ['1579783900882-c0d3dad7b119', '1579546929518-9e396f3cc809', '1541701494587-cb58502866ab'],
  fantasy: ['1518709268805-4e9042af9f23', '1534447677768-be436bb09401', '1514539079130-25950c84af65'],
  space: ['1506703719100-a0f3a48c0f86', '1451187580459-43490279c0fa', '1462331940025-496dfbfc7564'],
  nature: ['1470071459604-3b5ec3a7fe05', '1441974231531-c6227db76b6e', '1426604966848-d7adac402bff'],
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = (body?.prompt || 'Book cover illustration').trim();
    const seed = body?.seed || Math.floor(Math.random() * 10000000);

    const encodedPrompt = encodeURIComponent(prompt);

    // AI Generation endpoints with randomized seed
    const endpoints = [
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=600&height=900&model=flux&nologo=true&seed=${seed}`,
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=600&height=900&model=turbo&nologo=true&seed=${seed}`,
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=600&height=900&nologo=true&seed=${seed}`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer.byteLength > 2000) {
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const contentType = res.headers.get('content-type') || 'image/jpeg';
            return NextResponse.json({ dataUrl: `data:${contentType};base64,${base64}`, seed });
          }
        }
      } catch {
        // Try next endpoint
      }
    }

    // Dynamic art fallback with seed-matched Unsplash photos
    const promptLower = prompt.toLowerCase();
    let selectedCategory = 'fantasy';
    for (const key of Object.keys(THEME_PHOTO_IDS)) {
      if (promptLower.includes(key)) {
        selectedCategory = key;
        break;
      }
    }

    const photoList = THEME_PHOTO_IDS[selectedCategory] || THEME_PHOTO_IDS.fantasy;
    const photoId = photoList[seed % photoList.length];
    const unsplashUrl = `https://images.unsplash.com/photo-${photoId}?w=600&h=900&fit=crop&q=80&sig=${seed}`;

    const fallbackRes = await fetch(unsplashUrl);
    if (fallbackRes.ok) {
      const arrayBuffer = await fallbackRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return NextResponse.json({ dataUrl: `data:image/jpeg;base64,${base64}`, seed });
    }

    return NextResponse.json({ error: 'Génération indisponible' }, { status: 500 });
  } catch (err: any) {
    console.error('API Generate Cover Error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur lors de la génération' }, { status: 500 });
  }
}
