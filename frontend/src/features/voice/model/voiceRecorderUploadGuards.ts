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
  if (!hadVoice) return 'vad-no-voice';
  if (peakRms < VOICE_RECORDER_NO_VOICE_MAX_PEAK_RMS) return 'low-peak-rms';
  if (blobSize < VOICE_RECORDER_MIN_AUDIO_BYTES) return 'too-small';
  return null;
}
