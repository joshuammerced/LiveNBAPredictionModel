// Proxies the backend so the browser only ever talks to this app (no CORS, and BACKEND_URL
// is read at request time, so the same image works locally, in docker-compose and on Cloud Run).
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const ALLOWED_GET = new Set(['predictions', 'teams', 'matchup', 'model', 'players', 'prop']);
const ALLOWED_POST = new Set(['parlay']);
const MAX_BODY_BYTES = 20_000;

// On Cloud Run the backend is private: requests need a Google-signed identity token for this
// service's account (which has roles/run.invoker on the backend). Cloud Run sets K_SERVICE.
const USE_ID_TOKEN = Boolean(process.env.K_SERVICE) && BACKEND_URL.startsWith('https://');
const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=';
const TOKEN_TTL_MS = 50 * 60 * 1000; // tokens last an hour; refresh early

let cachedToken: { value: string; expires: number } | null = null;

async function idToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  const res = await fetch(METADATA_TOKEN_URL + encodeURIComponent(BACKEND_URL), {
    headers: { 'Metadata-Flavor': 'Google' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`metadata server returned ${res.status}`);
  cachedToken = { value: await res.text(), expires: Date.now() + TOKEN_TTL_MS };
  return cachedToken.value;
}

async function forward(path: string, init: RequestInit): Promise<Response> {
  const target = `${BACKEND_URL}/${path}`;
  try {
    const auth: Record<string, string> = USE_ID_TOKEN ? { Authorization: `Bearer ${await idToken()}` } : {};
    const res = await fetch(target, { ...init, cache: 'no-store', headers: { ...auth, ...(init.headers as Record<string, string>) } });
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`Backend request to ${target} failed:`, err);
    return Response.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Ctx) {
  const { path } = await params;
  if (path.length !== 1 || !ALLOWED_GET.has(path[0])) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return forward(`${path[0]}${new URL(request.url).search}`, { method: 'GET' });
}

export async function POST(request: Request, { params }: Ctx) {
  const { path } = await params;
  if (path.length !== 1 || !ALLOWED_POST.has(path[0])) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return Response.json({ error: 'Request too large' }, { status: 413 });
  }
  return forward(path[0], { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
}
