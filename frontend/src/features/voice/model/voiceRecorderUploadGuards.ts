import {
  VOICE_RECORDER_MANUAL_MIN_RECORDING_MS,
  VOICE_RECORDER_MIN_AUDIO_BYTES,
  VOICE_RECORDER_NO_VOICE_MAX_PEAK_RMS,
} from './voiceRecorder.constants';

type VoiceUploadSkipParams = {
  elapsedMs: number;
  hadVoice: boolean;
  peakRms: number;
  blobSize: number;
};

export type VoiceUploadSkipReason =
  | 'too-short'
  | 'vad-no-voice'
  | 'low-peak-rms'
  | 'too-small'
  | null;

export function getVoiceUploadSkipReason({
  elapsedMs,
  hadVoice,
  peakRms,
  blobSize,
}: VoiceUploadSkipParams): VoiceUploadSkipReason {
  if (elapsedMs < VOICE_RECORDER_MANUAL_MIN_RECORDING_MS) return 'too-short';
  if (blobSize < VOICE_RECORDER_MIN_AUDIO_BYTES) return 'too-small';

  // Telegram WebView on iOS/Android can produce a valid audio blob while the
  // browser analyser reports very low RMS or no VAD hit. Do not block upload in
  // that case: send the audio to STT and let the server decide if speech exists.
  if (!hadVoice && peakRms < VOICE_RECORDER_NO_VOICE_MAX_PEAK_RMS && blobSize < VOICE_RECORDER_MIN_AUDIO_BYTES * 3) {
    return 'low-peak-rms';
  }

  return null;
}
