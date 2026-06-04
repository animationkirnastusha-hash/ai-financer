import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

await runSmoke('ai-base', async (context) => {
  if (process.env.SKIP_AI_SMOKE === '1') {
    context.log('skipped by SKIP_AI_SMOKE=1');
    return;
  }

  const command = `создай счет smoke ${context.suffix} 1000 рублей`;
  const response = await requestJson(context, '/ai/parse', {
    method: 'POST',
    body: { command, execute: false, source: 'text' },
  });

  if (!response.payload || response.payload.success === false) {
    throw new Error(`AI smoke did not prepare action: ${JSON.stringify(response.payload)}`);
  }

  context.log('ai parse returned', {
    intent: response.payload.intent,
    executed: response.payload.executed,
    requiresConfirmation: response.payload.requiresConfirmation,
  });
});
