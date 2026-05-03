import { useCallback, useMemo, useState } from 'react';
import { useVoiceRecognition } from '@/features/voice/model/useVoiceRecognition';
import { useVoiceRecorder } from '@/features/voice/model/useVoiceRecorder';
import type {
  VoiceInputMode,
  VoiceInputState,
} from '@/features/voice/model/voice.types';

type UseVoiceInputParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
};

export function useVoiceInput({
  onText,
  lang = 'ru-RU',
}: UseVoiceInputParams) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speech = useVoiceRecognition({
    lang,
    onFinalText: onText,
  });

  const recorder = useVoiceRecorder({
    onText,
  });

  const mode = useMemo<VoiceInputMode>(() => {
    return speech.isSupported ? 'speech' : 'recorder';
  }, [speech.isSupported]);

  const start = useCallback(() => {
    window.speechSynthesis?.cancel();

    if (speech.isSupported) {
      speech.startListening();
      return;
    }

    void recorder.startRecording();
  }, [recorder, speech]);

  const stop = useCallback(() => {
    if (speech.isSupported) {
      speech.stopListening();
      return;
    }

    recorder.stopRecording();
  }, [recorder, speech]);

  const reset = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    speech.reset();
    recorder.reset();
  }, [recorder, speech]);

  const speak = useCallback(
    (text: string) => {
      const cleanText = text.trim();

      if (!cleanText || typeof window === 'undefined') return;
      if (!('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang;
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [lang],
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const state = useMemo<VoiceInputState>(() => {
    if (isSpeaking) return 'speaking';

    if (mode === 'speech') {
      if (speech.state === 'listening') return 'recording';
      if (speech.state === 'processing') return 'uploading';
      if (speech.state === 'error') return 'error';
      return 'idle';
    }

    return recorder.state;
  }, [isSpeaking, mode, recorder.state, speech.state]);

  const error = mode === 'speech' ? speech.error : recorder.error;
  const transcript = mode === 'speech' ? speech.transcript : '';
  const isSupported = speech.isSupported || recorder.isSupported;

  return {
    mode,
    state,
    error,
    transcript,
    isSupported,
    start,
    stop,
    reset,
    speak,
    stopSpeaking,
  };
}