import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = (body?.prompt || 'Book cover illustration').trim();
    const seed = Math.floor(Math.random() * 1000000);

    const endpoints = [
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=900&model=flux&nologo=true&seed=${seed}`,
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=900&nologo=true&seed=${seed}`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

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
            return NextResponse.json({ dataUrl: `data:${contentType};base64,${base64}` });
          }
        }
      } catch {
        // Retry next
      }
    }

    // High quality thematic art fallback if Pollinations times out
    const unsplashUrl = `https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&h=900&fit=crop&q=80`;
    const fallbackRes = await fetch(unsplashUrl);
    const arrayBuffer = await fallbackRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return NextResponse.json({ dataUrl: `data:image/jpeg;base64,${base64}` });
  } catch (err: any) {
    console.error('API Generate Cover Error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur lors de la génération' }, { status: 500 });
  }
}
