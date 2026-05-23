// Route: POST /api/fetch-repo
// Accepts { repoUrl } in the request body.
// Hits the GitHub Contents API to walk the repo tree and return
// the raw source of every file we can analyse (JS, TS, Python, etc.)
// We cap file content at 8 KB to stay within Groq's context limits.

const ALLOWED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx',
  '.py', '.java', '.go',
  '.c', '.cpp', '.h',
  '.rs', '.rb', '.php',
]);

// files / folders we never want to pull in — just noise
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build',
  '__pycache__', '.next', 'coverage', 'vendor',
]);

const MAX_FILE_BYTES = 8 * 1024;   // 8 KB per file
const MAX_FILES      = 25;         // keep well within Groq's free-tier token budget

// parse "https://github.com/owner/repo" → { owner, repo }
function parseGithubUrl(url) {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.replace(/^\//, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

// recursively walk the repo tree using the GitHub Contents API
async function walkTree(owner, repo, treePath, headers, collected) {
  if (collected.length >= MAX_FILES) return;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${treePath}`;
  const res = await fetch(apiUrl, { headers });
  if (!res.ok) return;

  const items = await res.json();
  if (!Array.isArray(items)) return;   // single file response — skip

  for (const item of items) {
    if (collected.length >= MAX_FILES) break;

    if (item.type === 'dir') {
      if (SKIP_DIRS.has(item.name)) continue;
      await walkTree(owner, repo, item.path, headers, collected);
    } else if (item.type === 'file') {
      const ext = '.' + item.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      if (item.size > MAX_FILE_BYTES) continue;

      // fetch the actual file content
      const fileRes = await fetch(item.download_url);
      if (!fileRes.ok) continue;

      const content = await fileRes.text();
      collected.push({ path: item.path, content });
    }
  }
}

export async function POST(request) {
  const { repoUrl } = await request.json();

  if (!repoUrl) {
    return Response.json({ error: 'repoUrl is required' }, { status: 400 });
  }

  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) {
    return Response.json({ error: 'Invalid GitHub URL' }, { status: 400 });
  }

  const { owner, repo } = parsed;

  // use the token if set, otherwise fall back to unauthenticated (60 req/hr limit)
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // verify the repo exists before walking
  const repoCheck = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers }
  );

  if (!repoCheck.ok) {
    const msg = repoCheck.status === 404
      ? 'Repository not found. Make sure it\'s public.'
      : 'GitHub API error. Try again in a moment.';
    return Response.json({ error: msg }, { status: repoCheck.status });
  }

  const repoMeta = await repoCheck.json();

  const files = [];
  await walkTree(owner, repo, '', headers, files);

  return Response.json({
    owner,
    repo,
    description: repoMeta.description,
    stars: repoMeta.stargazers_count,
    language: repoMeta.language,
    files,     // [{ path, content }]
  });
}
