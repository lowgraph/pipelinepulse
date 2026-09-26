import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/explain/route.js';

test('public explanation route never contacts a provider, even with configured credentials', async () => {
  const fetchBefore = globalThis.fetch;
  const urlBefore = process.env.LLM_EXPLANATION_URL;
  process.env.LLM_EXPLANATION_URL = 'https://private.invalid';
  globalThis.fetch = () => { throw new Error('Public route must not call fetch'); };
  try {
    const response = await POST(new Request('https://tiagomf.com/pipeline/api/explain', {
      method: 'POST', headers: { origin: 'https://tiagomf.com' }, body: '{}',
    }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'AI explanations are not enabled in the public demo.');
  } finally {
    globalThis.fetch = fetchBefore;
    if (urlBefore === undefined) delete process.env.LLM_EXPLANATION_URL;
    else process.env.LLM_EXPLANATION_URL = urlBefore;
  }
});
