import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

await runSmoke('analytics', async (context) => {
  for (const event of ['session_start', 'screen_view', 'screen_leave', 'session_pause']) {
    await requestJson(context, '/analytics/events', {
      method: 'POST',
      expected: [204],
      body: { event, data: { screen: 'smoke', suffix: context.suffix } },
    });
  }
  context.log('analytics allowed events accepted');
});
