import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ text: '[No file received]' });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await pdfParse(buffer);
    return NextResponse.json({ text: data.text || '[Could not extract text]' });
  } catch (err) {
    console.error('PDF extract error:', err);
    return NextResponse.json({ text: '[PDF could not be read — please paste the text directly]' });
  }
}
