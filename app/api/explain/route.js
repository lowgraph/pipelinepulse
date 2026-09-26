// Public demo: never import an LLM adapter or use a configured service URL.
// The private launcher owns its separate explanation route.
export const runtime = 'nodejs';
export async function POST() {
  return Response.json({ error: 'AI explanations are not enabled in the public demo.' }, {
    status: 403, headers: { 'Cache-Control': 'no-store' },
  });
}
