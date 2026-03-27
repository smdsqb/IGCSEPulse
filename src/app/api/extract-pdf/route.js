import { NextResponse } from 'next/server';
const pdfParse = require('pdf-parse');

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    console.log('FILE RECEIVED:', file ? `yes, size=${file.size}, type=${file.type}` : 'NO FILE');

    if (!file) return NextResponse.json({ text: '[No file received]' });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('BUFFER SIZE:', buffer.length);

    const data = await pdfParse(buffer);
    console.log('EXTRACTED TEXT LENGTH:', data.text?.length);

    return NextResponse.json({ text: data.text || '[Could not extract text]' });
  } catch (err) {
    console.error('PDF extract error:', err.message, err.stack);
    return NextResponse.json({ text: '[PDF could not be read — please paste the text directly]' });
  }
}
