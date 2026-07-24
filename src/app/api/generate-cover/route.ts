import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt requis' }, { status: 400 });
    }

    const seed = Math.floor(Math.random() * 1000000);
    // Use Pollinations AI image generation server-side (bypasses CORS)
    const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?width=600&height=900&nologo=true&seed=${seed}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(aiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ dataUrl });
  } catch (err: any) {
    console.error('API Generate Cover Error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur lors de la génération server-side' }, { status: 500 });
  }
}
