// Proxies the backend so the browser only ever talks to this app (no CORS, and BACKEND_URL
// is read at request time, so the same image works locally, in docker-compose, k8s and Cloud Run).
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const ALLOWED = new Set(['predictions', 'teams', 'matchup', 'model']);

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.length !== 1 || !ALLOWED.has(path[0])) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const target = `${BACKEND_URL}/${path[0]}${new URL(request.url).search}`;
  try {
    const res = await fetch(target, { cache: 'no-store' });
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return Response.json({ error: `Backend unreachable at ${BACKEND_URL}` }, { status: 502 });
  }
}
