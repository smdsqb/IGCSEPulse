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
- Be concise, student-friendly, and examiner-accurate.

Student question: ${question}`;

    // Google Gemini API - Correct endpoint with API key in headers
    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
        }
      }),
    });

    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return NextResponse.json({ 
        reply: `AI service error: ${response.status}. Please make sure your Gemini API key is valid.` 
      });
    }

    const result = await response.json();
    
    // Validate response structure
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      console.error('Invalid Gemini response structure:', result);
      return NextResponse.json({ 
        reply: 'Sorry, I received an invalid response. Please try again.' 
      });
    }
    
    const answer = result.candidates[0].content.parts[0].text;

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
    return NextResponse.json({ 
      reply: `Error: ${error.message || 'Please try again.'}` 
    }, { status: 500 });
  }
}
