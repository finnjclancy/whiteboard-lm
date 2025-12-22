import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { userQuestion, seedText } = await request.json();

    // Build a prompt for title generation based on the user's first question
    let prompt = 'Generate a very short title (3-6 words) that summarizes what this question is about. Return ONLY the title, no quotes, no punctuation at the end, no explanation.\n\n';
    
    if (seedText) {
      prompt += `Context (this is a branched conversation from): "${seedText.slice(0, 200)}"\n\n`;
    }
    
    prompt += `User's question: "${userQuestion}"`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates very short, descriptive titles. Keep titles to 3-6 words. Be specific and descriptive. Do not use quotes or punctuation at the end. Focus on the main topic of the question.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 20,
      temperature: 0.7,
    });

    const title = response.choices[0]?.message?.content?.trim() || 'untitled chat';

    return Response.json({ title });
  } catch (error) {
    console.error('Title generation error:', error);
    return Response.json({ error: 'Failed to generate title' }, { status: 500 });
  }
}
