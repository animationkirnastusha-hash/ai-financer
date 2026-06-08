import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

await runSmoke('voice-status', async (context) => {
  const status = await requestJson(context, '/voice/status');
  if (status.payload?.success !== true) throw new Error('Voice status did not return success=true');
  if (typeof status.payload?.configured !== 'boolean') throw new Error('Voice STT configured flag is invalid');
  if (!status.payload?.provider) throw new Error('Voice provider is missing');
  if (!status.payload?.model) throw new Error('Voice model is missing');
  if (typeof status.payload?.maxAudioMb !== 'number') throw new Error('Voice maxAudioMb is invalid');
  if (!Array.isArray(status.payload?.supportedProviders)) throw new Error('Voice supportedProviders is invalid');

  await requestJson(context, '/voice/debug', {
    method: 'POST',
    body: {
      event: 'predeploy_voice_debug_smoke',
      details: {
        mode: 'manual',
        state: 'idle',
        provider: status.payload.provider,
        model: status.payload.model,
        language: status.payload.language,
        blobSize: 0,
        hasText: false,
      },
    },
  });

  context.log('voice status passed', {
    configured: status.payload.configured,
    provider: status.payload.provider,
    model: status.payload.model,
  });
});
