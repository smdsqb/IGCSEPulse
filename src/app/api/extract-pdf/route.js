import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ text: '[No file received]' });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const text = extractTextFromPDF(buffer);
    return NextResponse.json({ text: text || '[Could not extract text from PDF]' });
  } catch (err) {
    console.error('PDF extract error:', err);
    return NextResponse.json({ text: '[PDF could not be read — please paste the text directly]' });
  }
}

function extractTextFromPDF(buffer) {
  try {
    const content = buffer.toString('latin1');
    const textParts = [];
    const btEtRegex = /BT([\s\S]*?)ET/g;
    let btMatch;
    while ((btMatch = btEtRegex.exec(content)) !== null) {
      const block = btMatch[1];
      const tjRegex = /\(((?:[^()\\]|\\[\s\S])*)\)\s*(?:Tj|'|")/g;
      const tjArrayRegex = /\[((?:[^\[\]]|\((?:[^()\\]|\\[\s\S])*\))*)\]\s*TJ/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        const decoded = decodePDFString(tjMatch[1]);
        if (decoded.trim()) textParts.push(decoded);
      }
      while ((tjMatch = tjArrayRegex.exec(block)) !== null) {
        const arrayContent = tjMatch[1];
        const strRegex = /\(((?:[^()\\]|\\[\s\S])*)\)/g;
        let strMatch;
        while ((strMatch = strRegex.exec(arrayContent)) !== null) {
          const decoded = decodePDFString(strMatch[1]);
          if (decoded.trim()) textParts.push(decoded);
        }
      }
    }
    return textParts.join(' ').replace(/\s+/g, ' ').trim();
  } catch (err) {
    return '';
  }
}

function decodePDFString(str) {
  return str
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, '$1');
}
