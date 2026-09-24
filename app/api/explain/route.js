import { createExplanation } from '../../../lib/explanation';
import { MAX_BYTES } from '../../../lib/pipeline';

export const runtime = 'nodejs';
export async function POST(request) {
  // Same-origin only, with an explicit streamed body limit; never trust client-supplied KPIs.
  const origin = request.headers.get('origin');
  const expectedOrigin = process.env.APP_ORIGIN || `${new URL(request.url).protocol}//${request.headers.get('host')}`;
  if (!origin || origin !== expectedOrigin) return Response.json({ error: 'A same-origin request is required.' }, { status: 403 });
  const max = MAX_BYTES * 2 + 65536;
  if (Number(request.headers.get('content-length')) > max) return Response.json({ error: 'Request too large.' }, { status: 413 });
  let size = 0; const chunks = []; const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'Missing request body.' }, { status: 400 });
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); return Response.json({ error: 'Request too large.' }, { status: 413 }); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    const result = await createExplanation(payload);
    return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Invalid request. Supply two CSV files as JSON strings.' }, { status: 400 }); }
}
