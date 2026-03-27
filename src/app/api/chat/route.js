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
    const { question, subject, marks, userId, sessionId, history = [] } = await request.json();

    const data = syllabuses[subject];
    if (!data) {
      return NextResponse.json({ reply: 'Subject not found.' });
    }

    const systemPrompt = `You are a Cambridge IGCSE ${data.name} (${data.code}) examiner and tutor.
Syllabus content: ${data.syllabus.content}
Topics: ${data.syllabus.topics?.map((t) => t.topicName).join(', ') || ''}
Rules:
- Answer based ONLY on the Cambridge IGCSE syllabus.
- For ${marks || 'any'} marks, follow the Cambridge marking scheme format.
- For 6+ marks, always include evaluation/judgement.
- Be concise, student-friendly, and examiner-accurate.
- You have access to the conversation history. Maintain context across messages.`;

    // Build messages array with history for multi-turn
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6), // last 6 messages for context
      { role: 'user', content: question },
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
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

    // Note: messages are now saved by the client directly to Firestore
    // We only log here for server-side audit if needed
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
