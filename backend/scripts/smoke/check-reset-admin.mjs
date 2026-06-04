import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

await runSmoke('reset-admin', async (context) => {
  const overview = await requestJson(context, '/admin/overview');
  if (!overview.payload) throw new Error('Admin overview returned empty payload');

  const users = await requestJson(context, '/admin/users');
  if (!Array.isArray(users.payload?.users)) throw new Error('Admin users did not return users array');

  // Safe cleanup of the test user's finance data. This should not delete the account itself.
  await requestJson(context, '/users/me/reset', {
    method: 'POST',
    body: { mode: 'finance' },
  });

  context.log('admin endpoints and current-user finance reset passed', { users: users.payload.users.length });
});
