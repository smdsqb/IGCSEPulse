import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ text: '[No file received]' });

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `The following is a base64-encoded PDF file. Please extract and return ONLY the raw text content from it, with no commentary, no explanation, just the text as it appears in the document.\n\nBase64 PDF:\n${base64.slice(0, 20000)}`,
          }
        ],
      }),
    });

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '[Could not extract text]';
    return NextResponse.json({ text });
  } catch (err) {
    console.error('PDF extract error:', err);
    return NextResponse.json({ text: '[PDF could not be read — please paste the text directly]' });
  }
}
