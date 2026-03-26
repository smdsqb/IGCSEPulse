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

// Initialise Firebase Admin only on the server
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
    const { question, subject, marks, userId } = await request.json();

    const data = syllabuses[subject];
    if (!data) {
      return NextResponse.json({
        reply: 'Subject not found. Choose: business, math, physics, chemistry, computer-science, english',
      });
    }

    const systemPrompt = `You are a Cambridge IGCSE ${data.name} (${data.code}) examiner and tutor.
Syllabus content: ${data.syllabus.content}
Topics: ${data.syllabus.topics?.map((t) => t.topicName).join(', ') || ''}
Rules:
- Answer based ONLY on the Cambridge IGCSE syllabus.
- For ${marks || 'any'} marks, follow the Cambridge marking scheme format.
- For 6+ marks, always include evaluation/judgement.
- Be concise, student-friendly, and examiner-accurate.`;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature: 0.3,
      }),
    });

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content ?? 'No response from AI.';

    // Save to Firestore using Admin SDK (server-safe)
    try {
      const adminDb = getAdminDb();
      await adminDb.collection('ai_chats').add({
        userId: userId || 'anonymous',
        subject,
        question,
        answer,
        marks: marks || null,
        timestamp: new Date(),
      });
    } catch (dbError) {
      console.error('Firebase save error:', dbError);
      // Non-fatal — still return the answer
    }

    return NextResponse.json({ reply: answer, code: data.code });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ reply: 'Error. Please try again.' }, { status: 500 });
  }
}
