import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { question, answer, marks, subject, keywords } = await request.json();

    const prompt = `You are a Cambridge IGCSE ${subject} examiner. Mark the following student answer.

Question: ${question}

Mark scheme keywords/concepts: ${keywords.join(", ")}

Total marks available: ${marks}

Student's answer: ${answer}

Instructions:
- Award marks based on how well the student covers the key concepts
- Be fair but strict like a real Cambridge examiner
- Maximum score is ${marks}

Respond in this EXACT JSON format with no other text:
{"score": <number>, "feedback": "<2-3 sentences explaining the mark, what was good, what was missing>"}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 300,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content ?? "";

    // Parse JSON response
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Clamp score to valid range
    const score = Math.min(Math.max(Math.round(parsed.score), 0), marks);

    return NextResponse.json({ score, feedback: parsed.feedback });
  } catch (err) {
    console.error("Mark challenge error:", err);
    return NextResponse.json({ score: 0, feedback: "Marking failed. Please try again." });
  }
}
