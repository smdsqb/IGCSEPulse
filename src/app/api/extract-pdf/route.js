import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ text: '[No file received]' });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Use unpdf — works in Edge runtime, no native deps, no test file crash
    const { extractText } = await import('unpdf');
    const { text } = await extractText(uint8Array, { mergePages: true });

    if (text && text.trim().length > 20) {
      return NextResponse.json({ text: text.slice(0, 8000) });
    }

    return NextResponse.json({ text: '[Could not extract text from this PDF — please paste the content directly]' });

  } catch (err) {
    console.error('PDF extract error:', err.message);
    return NextResponse.json({ text: '[PDF could not be read — please paste the text directly]' });
  }
}
