import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import business from '@/data/business_syllabus.json';
import math from '@/data/math_syllabus.json';
import physics from '@/data/physics_syllabus.json';
import chemistry from '@/data/chemistry_syllabus.json';
import cs from '@/data/computer-science_syllabus.json';
import english from '@/data/english_syllabus.json';

const syllabuses = { business, math, physics, chemistry, 'computer-science': cs, english };

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

// ── Get embedding for a query string ──────────────────────────────────────────
async function getQueryEmbedding(text) {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 384,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ── Query Pinecone for relevant past paper chunks ─────────────────────────────
async function queryPinecone(embedding, subject, topK = 5) {
  if (!process.env.PINECONE_HOST || !process.env.PINECONE_API_KEY) return [];

  try {
    const res = await fetch(`${process.env.PINECONE_HOST}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.PINECONE_API_KEY,
      },
      body: JSON.stringify({
        vector: embedding,
        topK,
        includeMetadata: true,
        filter: { subject: { $eq: subject } },
      }),
    });

    if (!res.ok) {
      console.error('[chat] Pinecone query failed:', res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return data.matches ?? [];
  } catch (err) {
    console.error('[chat] Pinecone query error:', err.message);
    return [];
  }
}

export async function POST(request) {
  try {
    const {
      question,
      subject,
      marks,
      userId,
      sessionId,
      history = [],
      imageBase64,
      imageType,
    } = await request.json();

    const data = syllabuses[subject];
    if (!data) return NextResponse.json({ reply: 'Subject not found.' });

    // ── RAG: fetch relevant past paper context ─────────────────────────
    let ragContext = '';
    try {
      const embedding = await getQueryEmbedding(question);
      if (embedding) {
        const matches = await queryPinecone(embedding, subject);
        if (matches.length > 0) {
          const chunks = matches
            .filter(m => m.score > 0.3) // only reasonably relevant chunks
            .map(m => `[Source: ${m.metadata?.source ?? 'past paper'}]\n${m.metadata?.text ?? ''}`)
            .join('\n\n');
          if (chunks) {
            ragContext = `\n\nRELEVANT PAST PAPER / MARK SCHEME CONTENT:\n${chunks}\n`;
          }
        }
      }
    } catch (ragErr) {
      // RAG is optional — don't break the whole request if it fails
      console.error('[chat] RAG pipeline error:', ragErr.message);
    }

    // ── Build system prompt ────────────────────────────────────────────
    const systemPrompt = `You are a Cambridge IGCSE ${data.name} (${data.code}) examiner and tutor.
Syllabus content: ${data.syllabus.content}
Topics: ${data.syllabus.topics?.map((t) => t.topicName).join(', ') || ''}
${ragContext}
Rules:
- Answer based on the Cambridge IGCSE syllabus and any file content the student shares.
- If RELEVANT PAST PAPER / MARK SCHEME CONTENT is provided above, use it to give more accurate, specific answers and reference it where appropriate.
- When the user uploads an image that appears to be handwritten work, treat it as a student answer submission. Read the handwriting carefully, identify what the student wrote, mark it against the Cambridge mark scheme for ${data.name}, state how many marks it would receive and why, identify missing key words or points, and provide a model answer.
- When the user uploads any other file or image, read its content carefully and help them with it in the context of IGCSE ${data.name}.
- For ${marks || 'any'} marks, follow the Cambridge marking scheme format.
- For 6+ marks, always include evaluation/judgement.
- Be concise, student-friendly, and examiner-accurate.
- You have access to the conversation history. Maintain context across messages.
- After your answer, always add these three things on separate lines at the very end:
  CONFIDENCE: [High/Medium/Low] - one word only
  RELATED_PP: [ONLY include this line if you are certain this exact question or a very similar one appeared in an official Cambridge IGCSE past paper. Format exactly as "o/n 2023 p2 q4" or "m/j 2022 p1 q7". If you are not certain, write "none".]
  SUGGESTIONS: [three short follow-up questions separated by | character]`;

    const userContent = imageBase64
      ? [
          { type: 'text', text: question },
          { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}` } },
        ]
      : question;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6),
      { role: 'user', content: userContent },
    ];

    // ── Call Groq ──────────────────────────────────────────────────────
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1200,
        temperature: 0.3,
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      return NextResponse.json({ reply: `AI service error: ${response.status}. Please try again.` });
    }

    const result = await response.json();
    if (!result.choices?.[0]) return NextResponse.json({ reply: 'Sorry, invalid response. Please try again.' });

    const fullText = result.choices[0].message.content;

    // ── Parse metadata from end of response ───────────────────────────
    const confidenceMatch  = fullText.match(/CONFIDENCE:\s*(High|Medium|Low)/i);
    const relatedPpMatch   = fullText.match(/RELATED_PP:\s*(.+?)(?:\n|$)/i);
    const suggestionsMatch = fullText.match(/SUGGESTIONS:\s*(.+?)(?:\n|$)/i);

    const confidence   = confidenceMatch?.[1] ?? null;
    const relatedPpRaw = relatedPpMatch?.[1]?.trim() ?? 'none';
    const relatedPp    = (relatedPpRaw === 'none' || relatedPpRaw === '' || relatedPpRaw.toLowerCase().includes('none')) ? null : relatedPpRaw;
    const suggestions  = suggestionsMatch?.[1]?.split('|').map(s => s.trim()).filter(Boolean) ?? [];

    const answer = fullText
      .replace(/CONFIDENCE:.*$/im, '')
      .replace(/RELATED_PP:.*$/im, '')
      .replace(/SUGGESTIONS:.*$/im, '')
      .trim();

    // ── Update Firebase ────────────────────────────────────────────────
    try {
      if (userId && userId !== 'anonymous' && sessionId) {
        const adminDb = getAdminDb();
        await adminDb.collection('users').doc(userId).set({
          aiQuestionCount: FieldValue.increment(1),
          rep: FieldValue.increment(2),
          lastActivity: new Date(),
        }, { merge: true });

        await adminDb
          .collection('ai_chats').doc(userId)
          .collection('sessions').doc(sessionId)
          .set({ lastActivity: new Date() }, { merge: true });
      }
    } catch (dbError) {
      console.error('Firebase update error:', dbError);
    }

    return NextResponse.json({ reply: answer, code: data.code, confidence, relatedPp, suggestions });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ reply: `Error: ${error.message || 'Please try again.'}` }, { status: 500 });
  }
}
