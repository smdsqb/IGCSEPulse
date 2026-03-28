import { NextResponse } from 'next/server';

// Convert a Uint8Array to a base64 string (Edge-safe)
function uint8ToBase64(uint8) {
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ text: '[No file received]' });

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // ── Step 1: try unpdf for text-based PDFs ────────────────────────────
    try {
      const { extractText } = await import('unpdf');
      const { text } = await extractText(uint8Array, { mergePages: true });
      if (text && text.trim().length > 20) {
        console.log('unpdf succeeded, text length:', text.trim().length);
        return NextResponse.json({ text: text.trim().slice(0, 8000) });
      }
    } catch (unpdfErr) {
      console.log('unpdf failed or no text layer:', unpdfErr.message);
    }

    // ── Step 2: scanned PDF — send raw PDF to Mistral vision OCR ─────────
    console.log('No text layer, falling back to Mistral OCR...');

    const mistralKey = process.env.MISTRAL_API_KEY;
    if (!mistralKey) {
      console.error('MISTRAL_API_KEY not set');
      return NextResponse.json({ text: '[OCR unavailable — API key not configured]' });
    }

    // Encode the PDF as base64 and send it directly to Mistral
    // Mistral's vision model accepts PDF documents via document_url with base64
    const base64Pdf = uint8ToBase64(uint8Array);

    const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest', // free tier, supports document understanding
        max_tokens: 4000,
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
                text: 'Please extract and return ALL the text content from this PDF exactly as it appears. Include all questions, text, data, and any tables. Do not summarise — return the raw content.',
              },
            ],
          },
        ],
      }),
    });

    if (!mistralRes.ok) {
      const errText = await mistralRes.text();
      console.error('Mistral API error:', mistralRes.status, errText);
      return NextResponse.json({ text: '[Could not read this PDF — please paste the content directly]' });
    }

    const mistralData = await mistralRes.json();
    const extractedText = mistralData.choices?.[0]?.message?.content;

    if (extractedText && extractedText.trim().length > 20) {
      console.log('Mistral OCR succeeded, text length:', extractedText.trim().length);
      return NextResponse.json({ text: extractedText.trim().slice(0, 8000) });
    }

    return NextResponse.json({ text: '[Could not extract text from this PDF — please paste the content directly]' });

  } catch (err) {
    console.error('PDF extract error:', err.message);
    return NextResponse.json({ text: '[PDF could not be read — please paste the text directly]' });
  }
}
