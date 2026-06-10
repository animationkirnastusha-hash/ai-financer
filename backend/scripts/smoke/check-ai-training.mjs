import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

await runSmoke('ai-training', async (context) => {
  const list = await requestJson(context, '/admin/ai-training');
  const items = Array.isArray(list.payload?.items) ? list.payload.items : [];

  if (!items.length) {
    context.log('ai training endpoint is available; no examples yet');
    return;
  }

  const item = items[0];
  if (!item.id || typeof item.input !== 'string') {
    throw new Error('AI training item has invalid shape');
  }

  const correctedOutput = item.correctedOutput || 'Smoke check: reviewed without changing business logic.';
  const updated = await requestJson(context, `/admin/ai-training/${item.id}`, {
    method: 'PATCH',
    body: {
      correctedOutput,
      success: Boolean(item.success),
    },
  });

  if (updated.payload?.result?.id !== item.id) {
    throw new Error('AI training update returned wrong item');
  }

  context.log('ai training flow passed', {
    checked: items.length,
    firstId: item.id,
  });
});
