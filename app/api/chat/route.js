import { NextResponse } from 'next/server';
import business from '@/data/business_syllabus.json';
import math from '@/data/math_syllabus.json';
import physics from '@/data/physics_syllabus.json';
import chemistry from '@/data/chemistry_syllabus.json';
import cs from '@/data/computer-science_syllabus.json';
import english from '@/data/english_syllabus.json';
import { saveChat } from '@/lib/firebase';

const subjects = { business, math, physics, chemistry, 'computer-science': cs, english };

export async function POST(request) {
  try {
    const { question, subject, marks, userId } = await request.json();
    const data = subjects[subject];
    
    if (!data) {
      return NextResponse.json({ reply: 'Subject not found. Choose: business, math, physics, chemistry, computer-science, english' });
    }
    
    const systemPrompt = `You are a Cambridge IGCSE ${data.name} (${data.code}) examiner. 
    Syllabus: ${data.syllabus.content}
    Topics: ${data.syllabus.topics.map(t => t.topicName).join(', ')}
    Rules: Answer based ONLY on Cambridge syllabus. For ${marks || 'any'} marks, follow marking scheme. For 6+ marks, include evaluation.`;
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.3
      })
    });
    
    const result = await response.json();
    const answer = result.choices[0].message.content;
    
    await saveChat(userId, subject, question, answer, marks);
    
    return NextResponse.json({ reply: answer, code: data.code });
    
  } catch (error) {
    return NextResponse.json({ reply: 'Error. Please try again.' }, { status: 500 });
  }
}
