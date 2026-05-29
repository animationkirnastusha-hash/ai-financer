import { useSettingsStore } from '@/features/settings/model/settings.store';

type MicrophonePermissionResult = {
  ok: boolean;
  state: PermissionState | 'unsupported' | 'unknown';
  error?: string;
};

export async function readMicrophonePermissionState(): Promise<PermissionState | 'unsupported' | 'unknown'> {
  if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    return 'unsupported';
  }

  if (!('permissions' in navigator)) return 'unknown';

  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
}

export async function requestOnboardingMicrophonePermission(): Promise<MicrophonePermissionResult> {
  const settings = useSettingsStore.getState();

  if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    settings.setVoicePermissionPrompted(false);
    return { ok: false, state: 'unsupported', error: 'unsupported' };
  }

  const currentState = await readMicrophonePermissionState();
  if (currentState === 'granted') {
    settings.setVoiceEnabled(true);
    settings.setVoiceBetaEnabled(true);
    settings.setVoicePermissionPrompted(true);
    return { ok: true, state: 'granted' };
  }

  if (currentState === 'denied') {
    settings.setVoicePermissionPrompted(false);
    return { ok: false, state: 'denied', error: 'denied' };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    stream.getTracks().forEach((track) => track.stop());
    settings.setVoiceEnabled(true);
    settings.setVoiceBetaEnabled(true);
    settings.setVoicePermissionPrompted(true);
    return { ok: true, state: 'granted' };
  } catch (error) {
    const errorName = error instanceof Error ? error.name || error.message : 'unknown';
    const nextState = await readMicrophonePermissionState();
    settings.setVoicePermissionPrompted(false);
    return { ok: false, state: nextState === 'granted' ? 'unknown' : nextState, error: errorName };
  }
}
