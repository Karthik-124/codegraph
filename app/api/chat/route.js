// Route: POST /api/chat
// Receives a user question + context about the currently selected node (optional)
// and the full graph summary, then answers using Groq streaming.
//
// We stream the response so the UI can show tokens as they arrive — makes the
// chat feel much faster even for longer explanations.

import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request) {
  const { messages, graphSummary, selectedNode, fileContents } = await request.json();

  if (!messages || messages.length === 0) {
    return Response.json({ error: 'messages are required' }, { status: 400 });
  }

  // build a system prompt that includes everything the model needs to answer well
  const contextParts = [
    'You are an expert code assistant helping a developer understand a GitHub codebase.',
    'Be concise, technical, and refer to specific files/functions when relevant.',
  ];

  if (graphSummary) {
    contextParts.push(`\nCodebase summary:\n${graphSummary}`);
  }

  if (selectedNode) {
    contextParts.push(
      `\nThe user currently has this node selected in the graph:` +
      `\n- Label: ${selectedNode.label}` +
      `\n- Type: ${selectedNode.type}` +
      `\n- File: ${selectedNode.file}` +
      `\n- Description: ${selectedNode.description}`
    );
  }

  if (fileContents) {
    // attach up to 3 relevant file snippets so the model can answer precisely
    contextParts.push(`\nRelevant code snippets:\n${fileContents}`);
  }

  const systemPrompt = contextParts.join('\n');

  // stream the response back so the UI can render tokens as they arrive
  const stream = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.4,
    max_tokens: 1024,
    stream: true,
  });

  // convert Groq's async iterator into a ReadableStream the browser can consume
  // also strip any <think>...</think> reasoning blocks before sending to client
  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let buffer = '';
      let insideThink = false;

      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (!delta) continue;

          buffer += delta;

          // suppress <think>...</think> reasoning tokens from being shown to user
          if (buffer.includes('<think>')) insideThink = true;
          if (insideThink) {
            if (buffer.includes('</think>')) {
              // emit everything after the closing tag
              const after = buffer.split('</think>').pop() ?? '';
              insideThink = false;
              buffer = '';
              if (after) controller.enqueue(encoder.encode(after));
            }
            // still inside think block — don't emit yet
            continue;
          }

          controller.enqueue(encoder.encode(buffer));
          buffer = '';
        }
        // flush any remaining buffer
        if (buffer && !insideThink) {
          controller.enqueue(encoder.encode(buffer));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
