import { NextResponse } from 'next/server';

export const maxDuration = 60;

// ── helpers ───────────────────────────────────────────────────────────────────
function uint8ToBase64(uint8) {
  return Buffer.from(uint8).toString('base64');
}

function chunkText(text, size = 400) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(' '));
  }
  return chunks.filter(c => c.trim().length > 0);
}

async function getEmbedding(text) {
  const res = await fetch('https://api.cohere.com/v1/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      texts: [text],
      model: 'embed-english-light-v3.0',
      input_type: 'search_document',
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Cohere embedding failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.embeddings[0];
}

// ── text extraction: unpdf → Mistral OCR fallback ────────────────────────────

async function extractTextFromPdf(uint8Array) {
  // Step 1: unpdf for text-layer PDFs
  try {
    const { extractText } = await import('unpdf');
    const { text } = await extractText(uint8Array, { mergePages: true });
    if (text && text.trim().length > 200) {
      console.log('[upload-pdf] unpdf succeeded, length:', text.trim().length);
      return text.trim();
    }
  } catch (err) {
    console.log('[upload-pdf] unpdf failed:', err.message);
  }

  // Step 2: scanned/image PDF — Mistral vision OCR
  console.log('[upload-pdf] Falling back to Mistral OCR...');
  const mistralKey = process.env.MISTRAL_API_KEY;
  if (!mistralKey) throw new Error('No text layer found and MISTRAL_API_KEY is not set — cannot OCR this PDF.');

  const base64Pdf = uint8ToBase64(uint8Array);

  const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mistralKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document_url',
              document_url: `data:application/pdf;base64,${base64Pdf}`,
            },
            {
              type: 'text',
              text: 'This is a Cambridge IGCSE past paper, mark scheme, or textbook chapter. Extract ALL text content preserving the structure as much as possible. For tables, format each row on a new line with cells separated by " | ". For financial data, preserve all numbers. Include every word, number, and label. Do not summarise anything.',
            },
          ],
        },
      ],
    }),
  });

  if (!mistralRes.ok) {
    const errText = await mistralRes.text();
    throw new Error(`Mistral OCR failed (${mistralRes.status}): ${errText}`);
  }

  const mistralData = await mistralRes.json();
  const extracted = mistralData.choices?.[0]?.message?.content;

  if (!extracted || extracted.trim().length < 50) {
    throw new Error('Mistral returned no usable text from this PDF.');
  }

  console.log('[upload-pdf] Mistral OCR succeeded, length:', extracted.trim().length);
  return extracted.trim();
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const subject = formData.get('subject');

    if (!file || !subject) {
      return NextResponse.json({ error: 'Missing file or subject' }, { status: 400 });
    }

    if (!process.env.COHERE_API_KEY) {
      return NextResponse.json({ error: 'COHERE_API_KEY is not set' }, { status: 500 });
    }
    if (!process.env.PINECONE_API_KEY) {
      return NextResponse.json({ error: 'PINECONE_API_KEY is not set' }, { status: 500 });
    }
    if (!process.env.PINECONE_HOST) {
      return NextResponse.json({ error: 'PINECONE_HOST is not set' }, { status: 500 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Extract text (unpdf → Mistral OCR fallback)
    let text;
    try {
      text = await extractTextFromPdf(uint8Array);
    } catch (err) {
      return NextResponse.json({ error: `PDF text extraction failed: ${err.message}` }, { status: 400 });
    }

    if (!text || text.length < 50) {
      return NextResponse.json({ error: 'Could not extract enough text from PDF.' }, { status: 400 });
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
