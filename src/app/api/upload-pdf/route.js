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
  const res = await fetch(
    'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`HuggingFace embedding failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return Array.isArray(data[0]) ? data[0] : data;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const subject = formData.get('subject');

    if (!file || !subject) {
      return NextResponse.json({ error: 'Missing file or subject' }, { status: 400 });
    }

    if (!process.env.HUGGINGFACE_API_KEY) {
      return NextResponse.json({ error: 'HUGGINGFACE_API_KEY is not set' }, { status: 500 });
    }
    if (!process.env.PINECONE_API_KEY) {
      return NextResponse.json({ error: 'PINECONE_API_KEY is not set' }, { status: 500 });
    }
    if (!process.env.PINECONE_HOST) {
      return NextResponse.json({ error: 'PINECONE_HOST is not set' }, { status: 500 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text = '';
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(buffer);
      text = pdfData.text?.trim();
    } catch (pdfErr) {
      return NextResponse.json({ error: `PDF parsing failed: ${pdfErr.message}` }, { status: 400 });
    }

    if (!text || text.length < 50) {
      return NextResponse.json({ error: 'Could not extract enough text from PDF. Make sure it is a text-based PDF, not a scanned image.' }, { status: 400 });
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No usable text chunks found in PDF' }, { status: 400 });
    }

    console.log(`[upload-pdf] "${file.name}" → ${chunks.length} chunks`);

    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      let embedding;
      try {
        embedding = await getEmbedding(chunks[i]);
      } catch (embErr) {
        return NextResponse.json({ error: `Embedding generation failed at chunk ${i}: ${embErr.message}` }, { status: 500 });
      }

      if (embedding && embedding.length === 384) {
        vectors.push({
          id: `${subject}-${file.name}-${i}`.replace(/[^a-zA-Z0-9-_]/g, '-'),
          values: embedding,
          metadata: { text: chunks[i], subject, source: file.name },
        });
      }
    }

    if (vectors.length === 0) {
      return NextResponse.json({ error: 'No valid embeddings were generated' }, { status: 500 });
    }

    const BATCH_SIZE = 100;
    for (let b = 0; b < vectors.length; b += BATCH_SIZE) {
      const batch = vectors.slice(b, b + BATCH_SIZE);
      const pineconeRes = await fetch(`${process.env.PINECONE_HOST}/vectors/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': process.env.PINECONE_API_KEY,
        },
        body: JSON.stringify({ vectors: batch }),
      });

      if (!pineconeRes.ok) {
        const pineconeErr = await pineconeRes.text();
        return NextResponse.json(
          { error: `Pinecone upsert failed (${pineconeRes.status}): ${pineconeErr}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, chunks: vectors.length, filename: file.name });

  } catch (error) {
    console.error('[upload-pdf] Unexpected error:', error);
    return NextResponse.json({ error: error.message ?? 'Unknown error' }, { status: 500 });
  }
}
