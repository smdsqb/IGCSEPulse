import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export const maxDuration = 60;

async function embedText(text) {
  const response = await fetch('https://api.groq.com/openai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'nomic-embed-text-v1_5',
      input: text,
    }),
  });
  const data = await response.json();
  return data.data?.[0]?.embedding ?? null;
}

function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const subject = formData.get('subject');

    if (!file || !subject) {
      return NextResponse.json({ error: 'Missing file or subject' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 });
    }

    const chunks = chunkText(text);

    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index('igcse-pulse', process.env.PINECONE_HOST);

    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i]);
      if (embedding) {
        vectors.push({
          id: `${subject}-${file.name}-${i}`,
          values: embedding,
          metadata: { text: chunks[i], subject, source: file.name },
        });
      }
    }

    await index.upsert(vectors);

    return NextResponse.json({ success: true, chunks: vectors.length, filename: file.name });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
