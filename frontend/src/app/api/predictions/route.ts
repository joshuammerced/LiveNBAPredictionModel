// Proxies the backend so the browser only ever talks to this app (no CORS, and BACKEND_URL
// is read at request time, so the same image works locally, in docker-compose, k8s and Cloud Run).
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/predictions`, { cache: 'no-store' });
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return Response.json({ error: `Backend unreachable at ${BACKEND_URL}` }, { status: 502 });
  }
}
