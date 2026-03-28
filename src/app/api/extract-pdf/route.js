import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ text: '[No file received]' });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF buffer without pdf-parse
    // Works reliably in Next.js serverless without CommonJS conflicts
    const text = extractTextFromPDFBuffer(buffer);

    if (text && text.length > 20) {
      return NextResponse.json({ text: text.slice(0, 8000) });
    }

    return NextResponse.json({ text: '[Could not extract text from this PDF — please paste the content directly]' });

  } catch (err) {
    console.error('PDF extract error:', err.message);
    return NextResponse.json({ text: '[PDF could not be read — please paste the text directly]' });
  }
}

function extractTextFromPDFBuffer(buffer) {
  try {
    // Convert buffer to binary string for regex parsing
    const binary = buffer.toString('binary');
    const textParts = [];

    // Extract text from BT...ET blocks (standard PDF text objects)
    const btEtRegex = /BT([\s\S]*?)ET/g;
    let btMatch;

    while ((btMatch = btEtRegex.exec(binary)) !== null) {
      const block = btMatch[1];

      // Match Tj operator — single string: (text) Tj
      const tjRegex = /\(((?:[^()\\]|\\[\s\S])*)\)\s*(?:Tj|'|")/g;
      let m;
      while ((m = tjRegex.exec(block)) !== null) {
        const decoded = decodePDFString(m[1]);
        if (decoded.trim().length > 0) textParts.push(decoded);
      }

      // Match TJ operator — array of strings: [(text)(more)] TJ
      const tjArrayRegex = /\[((?:[^\[\]]|\((?:[^()\\]|\\[\s\S])*\)|-?\d+(?:\.\d+)?)*)\]\s*TJ/g;
      while ((m = tjArrayRegex.exec(block)) !== null) {
        const strRegex = /\(((?:[^()\\]|\\[\s\S])*)\)/g;
        let s;
        while ((s = strRegex.exec(m[1])) !== null) {
          const decoded = decodePDFString(s[1]);
          if (decoded.trim().length > 0) textParts.push(decoded);
        }
      }
    }

    // Also try to grab raw text streams for simpler PDFs
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(binary)) !== null) {
      const content = streamMatch[1];
      // Only grab printable ASCII runs of reasonable length
      const printable = content.match(/[ -~]{8,}/g);
      if (printable) {
        printable.forEach(p => {
          const cleaned = p.replace(/[^\w\s.,;:!?'"()\-]/g, ' ').replace(/\s+/g, ' ').trim();
          if (cleaned.length > 6 && !/^[\d\s.]+$/.test(cleaned)) {
            textParts.push(cleaned);
          }
        });
      }
    }

    return textParts
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E\n]/g, '') // strip non-printable
      .trim();

  } catch (err) {
    console.error('PDF text extraction error:', err);
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
