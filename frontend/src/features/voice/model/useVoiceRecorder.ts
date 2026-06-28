import { usePressToTalkVoice } from '@/features/voice/core';

type UseVoiceRecorderParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  chunkMs?: number;
};

export function useVoiceRecorder({ onText, lang = 'ru-RU', chunkMs }: UseVoiceRecorderParams) {
  const voice = usePressToTalkVoice({ onText, lang, sessionMs: chunkMs });

  return {
    state: voice.state === 'recording' || voice.state === 'uploading' || voice.state === 'error' ? voice.state : 'idle',
    error: voice.error,
    isSupported: voice.isSupported,
    startRecording: voice.start,
    stopRecording: voice.stop,
    cancelRecording: voice.cancel,
    reset: voice.reset,
  };
}
