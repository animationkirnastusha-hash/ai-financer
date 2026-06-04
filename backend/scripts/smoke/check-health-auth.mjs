import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

await runSmoke('health-auth', async (context) => {
  const healthBaseUrl = context.baseUrl.replace(/\/api$/, '');
  const health = await fetch(`${healthBaseUrl}/health`);
  if (!health.ok) throw new Error(`/health returned ${health.status}`);

  const me = await requestJson(context, '/auth/me');
  if (!me.payload?.user?.id) throw new Error('/auth/me did not return user.id');
  context.log('authorized user', { id: me.payload.user.id, admin: me.payload.user.isAdmin });
});
