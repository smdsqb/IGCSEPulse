import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import business from '@/data/business_syllabus.json';
import math from '@/data/math_syllabus.json';
import physics from '@/data/physics_syllabus.json';
import chemistry from '@/data/chemistry_syllabus.json';
import cs from '@/data/computer-science_syllabus.json';
import english from '@/data/english_syllabus.json';

const syllabuses = {
  business,
  math,
  physics,
  chemistry,
  'computer-science': cs,
  english,
};

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

export async function POST(request) {
  try {
    const { question, subject, marks, userId, sessionId, history = [], imageBase64, imageType } = await request.json();

    const data = syllabuses[subject];
    if (!data) {
      return NextResponse.json({ reply: 'Subject not found.' });
    }

    const systemPrompt = `You are a Cambridge IGCSE ${data.name} (${data.code}) examiner and tutor.
Syllabus content: ${data.syllabus.content}
Topics: ${data.syllabus.topics?.map((t) => t.topicName).join(', ') || ''}

Rules:
- Answer based on the Cambridge IGCSE syllabus and any file content the student shares.
- When the user uploads an image, carefully analyse it and help them with its content in the context of IGCSE ${data.name}.
- For ${marks || 'any'} marks, follow the Cambridge marking scheme format.
- For 6+ marks, always include evaluation/judgement.
- Be concise, student-friendly, and examiner-accurate.
- You have access to the conversation history. Maintain context across messages.
- If file content appears garbled, partially extracted, or OCR-processed, still do your best to help based on whatever text is readable. Never ask the student to paste text manually if any file content was provided — always attempt to work with it.
- For Cambridge IGCSE Business Studies case study inserts, the content typically includes a business scenario with financial data, tables, and context. Use your knowledge of the syllabus to interpret and assist even if the extraction is imperfect.

Formatting rules (ALWAYS follow these):
- Use **bold** for key terms, headings, and important points (e.g. **Point**, **Evaluation**).
- Use bullet points (- ) for lists of points or examples.
- Use numbered lists (1. 2. 3.) for step-by-step answers or mark scheme structures.
- Use ### for section headings (e.g. ### Point, ### Evidence, ### Explanation, ### Evaluation).
- For mark scheme answers, always structure as: ### Point → ### Evidence → ### Explanation → ### Evaluation.
- Separate sections with a blank line.
- Never use asterisks as decorative symbols — only for **bold** and *italic*.
- Keep responses well-structured and easy to read.`;

    // Determine if this is an image message needing vision model
    const isImageMessage = !!(imageBase64 && imageType);
    const model = isImageMessage
      ? 'meta-llama/llama-4-scout-17b-16e-instruct'
      : 'llama-3.3-70b-versatile';

    // Build user content — vision format for images, plain string for text
    let userContent;
    if (isImageMessage) {
      userContent = [
        {
          type: 'image_url',
          image_url: {
            url: `data:${imageType};base64,${imageBase64}`,
          },
        },
        {
          type: 'text',
          text: question || 'Please analyse this image and help me with any IGCSE-related content.',
        },
      ];
    } else {
      userContent = question;
    }

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6),
      { role: 'user', content: userContent },
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
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

    if (!result.choices?.[0]) {
      console.error('Invalid Groq response:', result);
      return NextResponse.json({ reply: 'Sorry, I received an invalid response. Please try again.' });
    }

    const answer = result.choices[0].message.content;

    try {
      if (userId && userId !== 'anonymous' && sessionId) {
        const adminDb = getAdminDb();
        await adminDb
          .collection('ai_chats')
          .doc(userId)
          .collection('sessions')
          .doc(sessionId)
          .set({ lastActivity: new Date() }, { merge: true });
      }
    } catch (dbError) {
      console.error('Firebase update error:', dbError);
    }

    return NextResponse.json({ reply: answer, code: data.code });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ reply: `Error: ${error.message || 'Please try again.'}` }, { status: 500 });
  }
}
