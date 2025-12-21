import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages, seedText } = await request.json();

    // Build a prompt for title generation
    let prompt = 'Generate a very short title (3-6 words) that summarizes this conversation. Return ONLY the title, no quotes, no punctuation at the end, no explanation.\n\n';
    
    if (seedText) {
      prompt += `This conversation was branched from the text: "${seedText}"\n\n`;
    }
    
    prompt += 'Conversation:\n';
    for (const msg of messages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content.slice(0, 500)}${msg.content.length > 500 ? '...' : ''}\n`;
      }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates very short, descriptive titles for conversations. Keep titles to 3-6 words. Be specific and descriptive. Do not use quotes or punctuation at the end.',
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

