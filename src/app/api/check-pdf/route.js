export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const subject = searchParams.get('subject');

    if (!filename || !subject) {
      return NextResponse.json({ exists: false });
    }

    if (!process.env.PINECONE_HOST || !process.env.PINECONE_API_KEY) {
      return NextResponse.json({ exists: false });
    }

    // Reconstruct the ID of chunk 0 — if it exists, the file was uploaded
    const id = `${subject}-${filename}-0`.replace(/[^a-zA-Z0-9-_]/g, '-');

    const res = await fetch(`${process.env.PINECONE_HOST}/vectors/fetch?ids=${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ exists: false });
    }

    const data = await res.json();
    const exists = Object.keys(data.vectors ?? {}).length > 0;

    return NextResponse.json({ exists });

  } catch (err) {
    console.error('[check-pdf] Error:', err.message);
    return NextResponse.json({ exists: false });
  }
}
