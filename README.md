# CodeGraph — Visual Codebase Explorer

> Paste any public GitHub repo URL → get an interactive knowledge graph of every file, function, and class → chat with the codebase using AI.

## What it does

- **Fetches** all source files from any public GitHub repo via the GitHub Contents API
- **Analyses** the code with Groq's Llama 3 70B to extract functions, classes, imports, and their relationships
- **Renders** an interactive force-directed knowledge graph using Cytoscape.js
- **Chat** — click any node and ask questions about that specific file/function, powered by streaming Groq responses

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Graph viz | Cytoscape.js (cose layout) |
| AI | Groq API — Llama 3.3 70B |
| Data source | GitHub Contents API |
| Styling | Vanilla CSS (no Tailwind) |
| Deploy | Vercel |

## Getting started

### 1. Clone & install

```bash
git clone https://github.com/your-username/codegraph.git
cd codegraph
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) — free tier available |
| `GITHUB_TOKEN` | [github.com/settings/tokens](https://github.com/settings/tokens) — no scopes needed for public repos |

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Add `GROQ_API_KEY` and `GITHUB_TOKEN` in your Vercel project's Environment Variables settings.

## Project structure

```
app/
  page.js                # Landing page — repo URL input
  graph/
    page.js              # Graph explorer — main UI
  api/
    fetch-repo/route.js  # GitHub API: walk repo tree, fetch files
    analyze/route.js     # Groq: analyse code, return graph JSON
    chat/route.js        # Groq: streaming chat with codebase context
components/
  GraphView.js           # Cytoscape.js interactive graph
  ChatPanel.js           # Streaming chat sidebar
  NodeDetail.js          # Node info overlay
```

## Limitations

- Only analyses **public** repositories
- File limit: 40 files max, 8 KB per file (to stay within Groq's context window)
- Supports: `.js .jsx .ts .tsx .py .java .go .c .cpp .rs .rb .php`

## Author

Built by **Polishetty Karthik** — [GitHub](https://github.com/Karthik-1245)
