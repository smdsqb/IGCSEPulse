import { NextResponse } from 'next/server';

export const maxDuration = 60;

function chunkText(text, size = 400) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(' '));
  }
  return chunks.filter(c => c.trim().length > 0);
}

async function getEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  const data = await res.json();
  return data.data?.[0]?.embedding ?? null;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const subject = formData.get('subject');

    if (!file || !subject) {
      return NextResponse.json({ error: 'Missing file or subject' }, { status: 400 });
    }

    // Extract text from PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text?.trim();

    if (!text) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 });
    }

    const chunks = chunkText(text);

    // Upsert to Pinecone via REST API directly
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      if (embedding) {
        vectors.push({
          id: `${subject}-${file.name}-${i}`.replace(/[^a-zA-Z0-9-_]/g, '-'),
          values: embedding,
          metadata: { text: chunks[i], subject, source: file.name },
        });
      }
    }

    // Send to Pinecone
    const pineconeRes = await fetch(`${process.env.PINECONE_HOST}/vectors/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.PINECONE_API_KEY,
      },
      body: JSON.stringify({ vectors }),
    });

    const pineconeData = await pineconeRes.json();

    if (!pineconeRes.ok) {
      return NextResponse.json({ error: pineconeData.message ?? 'Pinecone error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, chunks: vectors.length, filename: file.name });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
