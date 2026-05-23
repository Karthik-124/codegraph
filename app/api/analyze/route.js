// Route: POST /api/analyze
// Takes the fetched repo files and asks Groq (Llama 3 70B) to analyse them.
// Returns a graph payload: { nodes: [...], edges: [...] } that Cytoscape can render.
//
// Node types:  file | function | class | import
// Edge types:  contains | calls | imports | extends
//
// Token budget: Groq free tier is 12,000 TPM for llama-3.3-70b-versatile.
// We keep well under that by: capping files at 25, lines per file at 60,
// and using a concise system prompt.

import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// max files and lines we'll include in the prompt — keeps us under 12k TPM
const MAX_FILES_TO_ANALYSE = 25;
const MAX_LINES_PER_FILE   = 60;

// concise system prompt — every token saved here is a token for actual code
const SYSTEM_PROMPT = `You are a code analysis engine. Analyse the given source files and return ONLY valid JSON:

{
  "nodes": [
    { "id": "unique_id", "label": "name", "type": "file|function|class|import", "file": "path", "description": "one sentence" }
  ],
  "edges": [
    { "source": "id", "target": "id", "type": "contains|calls|imports|extends" }
  ],
  "summary": "2-3 sentences about what this codebase does"
}

Rules: one node per file (type=file); extract key functions/classes/imports; max 60 nodes total; edge source/target must exist; return ONLY the JSON, no markdown.`;

export async function POST(request) {
  const { files, owner, repo } = await request.json();

  if (!files || files.length === 0) {
    return Response.json({ error: 'No files provided' }, { status: 400 });
  }

  // take only the first N files to stay within the token budget
  const filesToAnalyse = files.slice(0, MAX_FILES_TO_ANALYSE);

  // truncate each file to MAX_LINES_PER_FILE — enough to understand structure
  const codeBlock = filesToAnalyse
    .map(({ path, content }) => {
      const lines = content.split('\n').slice(0, MAX_LINES_PER_FILE).join('\n');
      return `// FILE: ${path}\n${lines}`;
    })
    .join('\n\n');

  const userMessage = `Repo: ${owner}/${repo}\n\n${codeBlock}`;

  // rough token estimate — warn in console if we're getting close to the limit
  const estimatedTokens = Math.ceil((SYSTEM_PROMPT.length + userMessage.length) / 4);
  console.log(`[analyze] ~${estimatedTokens} tokens estimated for ${filesToAnalyse.length} files`);

  if (estimatedTokens > 11000) {
    console.warn('[analyze] token estimate is high — truncation may be needed');
  }

  try {
    const completion = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      temperature: 0.1,   // low temp → deterministic JSON output
      max_tokens:  3000,  // leave headroom within the TPM window
    });

    const raw = completion.choices[0]?.message?.content ?? '';

    // strip any accidental markdown fences the model added
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let graph;
    try {
      graph = JSON.parse(cleaned);
    } catch {
      console.error('[analyze] Groq returned non-JSON:', raw.slice(0, 300));
      return Response.json(
        { error: 'Model returned malformed JSON. Try a smaller repo.' },
        { status: 500 }
      );
    }

    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return Response.json(
        { error: 'Unexpected response shape from model.' },
        { status: 500 }
      );
    }

    return Response.json(graph);
  } catch (err) {
    console.error('[analyze] Groq API error:', err.message);

    // surface a friendlier message for the common token-limit error
    const isTokenError = err.message?.includes('413') || err.message?.includes('rate_limit');
    const userMessage2 = isTokenError
      ? 'Repository is too large for the free Groq tier. Try a smaller repo (under ~30 files).'
      : 'Groq API error: ' + err.message;

    return Response.json({ error: userMessage2 }, { status: 500 });
  }
}
