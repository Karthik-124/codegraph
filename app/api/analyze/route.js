// Route: POST /api/analyze
// Takes the fetched repo files and asks Groq (Llama 3 70B) to analyse them.
// Returns a graph payload: { nodes: [...], edges: [...] } that Cytoscape can render.
//
// Node types:  file | function | class | import
// Edge types:  contains | calls | imports | extends

import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// the system message tells the model exactly what JSON shape to return
const SYSTEM_PROMPT = `You are a code analysis engine. 
Given source files from a GitHub repository, analyse the code and return ONLY valid JSON with this exact shape:

{
  "nodes": [
    {
      "id": "unique_string",
      "label": "display name",
      "type": "file | function | class | import",
      "file": "path/to/file.js",
      "description": "one sentence about what this does"
    }
  ],
  "edges": [
    {
      "source": "node_id",
      "target": "node_id",
      "type": "contains | calls | imports | extends"
    }
  ],
  "summary": "2-3 sentence summary of what the codebase does overall"
}

Rules:
- Every file gets exactly one node with type "file".
- Extract the top-level functions, classes, and significant imports from each file.
- Keep node count under 80 total — group trivial helpers under their parent file if needed.
- Edge source/target must reference existing node IDs.
- Return ONLY the JSON object — no prose, no markdown fences.`;

export async function POST(request) {
  const { files, owner, repo } = await request.json();

  if (!files || files.length === 0) {
    return Response.json({ error: 'No files provided' }, { status: 400 });
  }

  // build a compact representation of the code to send to Groq
  // we truncate each file to 120 lines so the prompt fits in the context window
  const codeBlock = files
    .map(({ path, content }) => {
      const lines = content.split('\n').slice(0, 120).join('\n');
      return `// === FILE: ${path} ===\n${lines}`;
    })
    .join('\n\n');

  const userMessage = `Repository: ${owner}/${repo}\n\nFiles:\n\n${codeBlock}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      temperature: 0.1,   // low temp → more deterministic JSON output
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content ?? '';

    // strip any accidental markdown fences the model added
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let graph;
    try {
      graph = JSON.parse(cleaned);
    } catch {
      console.error('Groq returned non-JSON:', raw.slice(0, 300));
      return Response.json(
        { error: 'Model returned malformed JSON. Try a smaller repo.' },
        { status: 500 }
      );
    }

    // sanity-check the shape before returning
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return Response.json(
        { error: 'Unexpected response shape from model.' },
        { status: 500 }
      );
    }

    return Response.json(graph);
  } catch (err) {
    console.error('Groq API error:', err.message);
    return Response.json(
      { error: 'Groq API error: ' + err.message },
      { status: 500 }
    );
  }
}
