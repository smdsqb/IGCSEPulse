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
    const { 
      question, 
      subject, 
      marks, 
      userId, 
      sessionId, 
      history = [], 
      imageBase64, 
      imageType 
    } = await request.json();

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
- For ${marks || 'any'} marks, follow the Cambridge marking scheme format (AO1 Knowledge, AO2 Application, AO3 Analysis, AO4 Evaluation).
- For 6+ marks, always include a final justified evaluation/judgement.
- Be concise, student-friendly, and examiner-accurate.
- You have access to the conversation history. Maintain context across messages.

Formatting rules (STRICTLY FOLLOW THESE):
- Use ### for section headings (e.g. ### Knowledge, ### Analysis, ### Evaluation).
- Use **bold** for key terms, definitions, and marks-earning points.
- Use bullet points (- ) for lists or specific marking points.
- Use numbered lists (1. 2. 3.) ONLY for step-by-step procedures or chronological processes.
- Separate distinct sections with a blank line.
- Do not use asterisks for decoration, only for **bolding**.
- Structure answers as: ### Point → ### Evidence → ### Explanation → ### Evaluation.`;

    // Determine if this is an image message needing vision model
    const isImageMessage = !!(imageBase64 && imageType);
    
    // Using high-reasoning models for examiner accuracy
    const model = isImageMessage
      ? 'llama-3.2-11b-vision-preview' 
      : 'llama-3.3-70b-versatile';

    let userContent;
    if (isImageMessage) {
      userContent = [
        {
          type: 'text',
          text: question || 'Please analyse this image in the context of my IGCSE studies.',
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${imageType};base64,${imageBase64}`,
          },
        },
      ];
    } else {
      userContent = question;
    }

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6), // Keep context while managing token limits
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
        max_tokens: 1200,
        temperature: 0.2, // Lower temperature for higher factual accuracy
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      return NextResponse.json({ reply: `AI service error. Please try again.` }, { status: response.status });
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content;

    if (!answer) {
      return NextResponse.json({ reply: 'I could not generate a response. Please rephrase your question.' });
    }

    // Background Firebase update
    if (userId && userId !== 'anonymous' && sessionId) {
      try {
        const adminDb = getAdminDb();
        await adminDb
          .collection('ai_chats')
          .doc(userId)
          .collection('sessions')
          .doc(sessionId)
          .set({ lastActivity: new Date() }, { merge: true });
      } catch (dbError) {
        console.error('Firebase silent error:', dbError);
      }
    }

    return NextResponse.json({ 
      reply: answer, 
      code: data.code,
      subjectName: data.name 
    });

  } catch (error) {
    console.error('Final API Catch:', error);
    return NextResponse.json({ reply: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}
