import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { explanationHandler } from '../scripts/local-chatgpt-adapter.mjs';

test('local summary rejects foreign origins and forwards only recomputed anonymous facts', async () => {
  let calls = 0;
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  server.on('request', explanationHandler(port, async (_url, options) => {
    calls++;
    const forwarded = JSON.parse(options.body);
    assert.equal(forwarded.facts.totals.spend, 100);
    assert.equal(forwarded.facts.totals.revenue, 300);
    assert.ok(!options.body.includes('PRIVATE_CAMPAIGN'));
    assert.ok(!options.body.includes('private@example.com'));
    assert.match(forwarded.instructions, /Brazilian Portuguese/);
    return Response.json({ text: 'Resumo verificado.' });
  }));
  const url = `http://127.0.0.1:${port}`;
  const post = (body, origin = url) => fetch(url, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post({}, 'https://tiagomf.com')).status, 403);
    assert.equal((await post({})).status, 400);
    assert.equal(calls, 0);
    const result = await post({ ads: 'campaign,spend\nPRIVATE_CAMPAIGN,100', crm: 'id,campaign,revenue,status,email\n1,PRIVATE_CAMPAIGN,300,closed won,private@example.com', language: 'pt', totals: { spend: 999999 } });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { text: 'Resumo verificado.' });
    assert.equal(calls, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
