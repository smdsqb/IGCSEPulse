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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    // DEBUG — remove this after fixing
    console.log('DEBUG KEY:', apiKey ? `exists, length=${apiKey.length}, starts=${apiKey.substring(0, 10)}` : 'UNDEFINED');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: question }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return NextResponse.json({
        reply: `AI service error: ${response.status}. Please check your Anthropic API key.`,
      });
    }

    const result = await response.json();

    if (!result.content || !result.content[0]) {
      console.error('Invalid Claude response structure:', result);
      return NextResponse.json({
        reply: 'Sorry, I received an invalid response. Please try again.',
      });
    }

    const answer = result.content[0].text;

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
    }

    return NextResponse.json({ reply: answer, code: data.code });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      reply: `Error: ${error.message || 'Please try again.'}`,
    }, { status: 500 });
  }
}
