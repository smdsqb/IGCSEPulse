import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { filename, subject } = await request.json();

    if (!filename || !subject) {
      return NextResponse.json({ error: 'Missing filename or subject' }, { status: 400 });
    }

    if (!process.env.PINECONE_HOST || !process.env.PINECONE_API_KEY) {
      return NextResponse.json({ error: 'Pinecone env vars not set' }, { status: 500 });
    }

    // ── Step 1: fetch all vector IDs for this file by listing chunks ────
    // We try chunk IDs 0..499 and collect which ones exist
    // Pinecone free tier doesn't support metadata filtering so we reconstruct IDs
    const prefix = `${subject}-${filename}`.replace(/[^a-zA-Z0-9-_]/g, '-');

    // Build candidate IDs for up to 500 chunks (covers most textbooks)
    const candidateIds = Array.from({ length: 500 }, (_, i) => `${prefix}-${i}`);

    // Fetch in batches of 100 (Pinecone limit)
    const existingIds: string[] = [];
    const FETCH_BATCH = 100;

    for (let b = 0; b < candidateIds.length; b += FETCH_BATCH) {
      const batch = candidateIds.slice(b, b + FETCH_BATCH);
      const queryString = batch.map(id => `ids=${encodeURIComponent(id)}`).join('&');

      const res = await fetch(`${process.env.PINECONE_HOST}/vectors/fetch?${queryString}`, {
        method: 'GET',
        headers: { 'Api-Key': process.env.PINECONE_API_KEY },
      });

      if (!res.ok) continue;

      const data = await res.json();
      const found = Object.keys(data.vectors ?? {});
      existingIds.push(...found);

      // If we got fewer results than batch size, no point checking further
      if (found.length === 0) break;
    }

    if (existingIds.length === 0) {
      return NextResponse.json({
        error: `No vectors found for "${filename}" under subject "${subject}". Check the filename and subject are correct.`
      }, { status: 404 });
    }

    // ── Step 2: delete the found IDs ─────────────────────────────────────
    const DELETE_BATCH = 100;
    for (let b = 0; b < existingIds.length; b += DELETE_BATCH) {
      const batch = existingIds.slice(b, b + DELETE_BATCH);

      const deleteRes = await fetch(`${process.env.PINECONE_HOST}/vectors/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': process.env.PINECONE_API_KEY,
        },
        body: JSON.stringify({ ids: batch }),
      });

      if (!deleteRes.ok) {
        const errText = await deleteRes.text();
        return NextResponse.json(
          { error: `Pinecone delete failed (${deleteRes.status}): ${errText}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, deleted: existingIds.length });

  } catch (error) {
    console.error('[delete-pdf] Error:', error.message);
    return NextResponse.json({ error: error.message ?? 'Unknown error' }, { status: 500 });
  }
}
