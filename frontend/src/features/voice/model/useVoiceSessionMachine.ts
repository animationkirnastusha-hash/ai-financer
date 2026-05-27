import { useCallback, useEffect, useRef, useState } from 'react';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import {
  VOICE_AFTER_DISPATCH_COOLDOWN_MS,
  VOICE_COMMAND_CAPTURE_TIMEOUT_MS,
  VOICE_COMMAND_SESSION_MS,
  VOICE_WAKE_SESSION_MS,
} from '@/features/voice/model/voiceConstants';
import type {
  VoiceBubbleTone,
  VoiceCaptureMode,
  VoiceSessionPhase,
  VoiceSessionSegment,
} from '@/features/voice/model/voiceSession.types';
import { normalizeVoiceText, shouldIgnoreVoiceCommand } from '@/features/voice/model/voiceText';
import { stripWakeWord } from '@/features/voice/model/voiceWakeWord';

type UseVoiceSessionMachineParams = {
  companionName: string;
  showThought: (text: string, tone?: VoiceBubbleTone, timeoutMs?: number) => void;
  dispatchCommand: (params: { sessionId: string; finalText: string; segments: VoiceSessionSegment[] }) => Promise<void>;
};

function buildFinalText(segments: VoiceSessionSegment[]) {
  return segments.map((segment) => segment.text).join(' ').replace(/\s+/g, ' ').trim();
}

function makeSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `voice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useVoiceSessionMachine({ companionName, showThought, dispatchCommand }: UseVoiceSessionMachineParams) {
  const [captureMode, setCaptureMode] = useState<VoiceCaptureMode>('wake');
  const [phase, setPhase] = useState<VoiceSessionPhase>('idle');
  const [isDispatching, setIsDispatching] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const captureModeRef = useRef<VoiceCaptureMode>('wake');
  const phaseRef = useRef<VoiceSessionPhase>('idle');
  const segmentsRef = useRef<VoiceSessionSegment[]>([]);
  const sessionIdRef = useRef('');
  const commandTimeoutRef = useRef<number | null>(null);
  const dispatchingRef = useRef(false);

  const setMachinePhase = useCallback((nextPhase: VoiceSessionPhase, nextMode: VoiceCaptureMode) => {
    phaseRef.current = nextPhase;
    captureModeRef.current = nextMode;
    setPhase(nextPhase);
    setCaptureMode(nextMode);
    logVoiceDebugEvent('voice_state_changed', { phase: nextPhase, captureMode: nextMode });
  }, []);

  const clearCommandTimeout = useCallback(() => {
    if (commandTimeoutRef.current !== null) {
      window.clearTimeout(commandTimeoutRef.current);
      commandTimeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearCommandTimeout();
    segmentsRef.current = [];
    sessionIdRef.current = '';
    setMachinePhase('idle', 'wake');
  }, [clearCommandTimeout, setMachinePhase]);

  const ensureSession = useCallback(() => {
    if (!sessionIdRef.current) sessionIdRef.current = makeSessionId();
    return sessionIdRef.current;
  }, []);

  const appendSegment = useCallback((rawText: string) => {
    const text = normalizeVoiceText(rawText);
    if (shouldIgnoreVoiceCommand(text)) return false;

    ensureSession();
    const role = segmentsRef.current.length === 0 ? 'initial' : 'continuation';
    const segment: VoiceSessionSegment = { text, role, at: Date.now() };
    segmentsRef.current = [...segmentsRef.current, segment].slice(-6);

    logVoiceDebugEvent('voice_session_segment_added', {
      role,
      textLength: text.length,
      segmentCount: segmentsRef.current.length,
    });

    return true;
  }, [ensureSession]);

  const finalizeAndDispatch = useCallback(async () => {
    if (dispatchingRef.current) return;

    clearCommandTimeout();
    const segments = segmentsRef.current;
    const finalText = buildFinalText(segments);

    if (!segments.length || !finalText) {
      reset();
      return;
    }

    dispatchingRef.current = true;
    setIsDispatching(true);
    setMachinePhase('dispatching', 'wake');
    logVoiceDebugEvent('voice_session_finalized', {
      textLength: finalText.length,
      segmentCount: segments.length,
      correctionCount: segments.filter((segment) => segment.role === 'correction').length,
    });
    showThought('Выполняю...', 'thinking', 2400);

    try {
      await dispatchCommand({ sessionId: sessionIdRef.current || makeSessionId(), finalText, segments });
    } finally {
      dispatchingRef.current = false;
      setIsDispatching(false);
      segmentsRef.current = [];
      sessionIdRef.current = '';
      const nextCooldownUntil = Date.now() + VOICE_AFTER_DISPATCH_COOLDOWN_MS;
      setCooldownUntil(nextCooldownUntil);
      setMachinePhase('cooldown', 'wake');
    }
  }, [clearCommandTimeout, dispatchCommand, reset, setMachinePhase, showThought]);

  const startCommandCapture = useCallback(() => {
    ensureSession();
    clearCommandTimeout();
    setMachinePhase('command', 'command');
    showThought('Слушаю команду.', 'listening', 3600);

    commandTimeoutRef.current = window.setTimeout(() => {
      if (segmentsRef.current.length > 0) {
        void finalizeAndDispatch();
        return;
      }
      logVoiceDebugEvent('command_capture_timeout');
      reset();
      showThought(`Скажи «${companionName || 'Фина'}» и команду ещё раз.`, 'warning', 3200);
    }, VOICE_COMMAND_CAPTURE_TIMEOUT_MS);
  }, [clearCommandTimeout, companionName, ensureSession, finalizeAndDispatch, reset, setMachinePhase, showThought]);

  const handleTranscript = useCallback(async (rawText: string) => {
    const originalText = normalizeVoiceText(rawText);
    if (!originalText || dispatchingRef.current) return;

    if (captureModeRef.current === 'command') {
      const wake = stripWakeWord(originalText, companionName);
      const command = normalizeVoiceText(wake.hasWakeWord ? wake.command : originalText);
      logVoiceDebugEvent('command_capture_text_received', {
        textLength: command.length,
        hadWakeWord: wake.hasWakeWord,
        hasText: Boolean(command),
      });

      if (!appendSegment(command)) return;
      await finalizeAndDispatch();
      return;
    }

    const wake = stripWakeWord(originalText, companionName);
    if (!wake.hasWakeWord) {
      logVoiceDebugEvent('wake_word_not_detected', {
        textLength: originalText.length,
        hasText: Boolean(originalText),
        visualOnly: true,
      });
      return;
    }

    const command = normalizeVoiceText(wake.command);
    logVoiceDebugEvent('wake_word_detected', {
      textLength: originalText.length,
      hasText: Boolean(originalText),
      commandLength: command.length,
    });

    if (!command) {
      startCommandCapture();
      return;
    }

    if (!appendSegment(command)) {
      startCommandCapture();
      return;
    }

    await finalizeAndDispatch();
  }, [appendSegment, companionName, finalizeAndDispatch, startCommandCapture]);

  useEffect(() => {
    if (phase !== 'cooldown') return undefined;

    const delay = Math.max(0, cooldownUntil - Date.now());
    const timer = window.setTimeout(() => {
      if (phaseRef.current === 'cooldown') setMachinePhase('idle', 'wake');
    }, delay);

    return () => window.clearTimeout(timer);
  }, [cooldownUntil, phase, setMachinePhase]);

  useEffect(() => () => {
    clearCommandTimeout();
  }, [clearCommandTimeout]);

  return {
    captureMode,
    phase,
    isDispatching,
    cooldownUntil,
    recordSessionMs: captureMode === 'command' ? VOICE_COMMAND_SESSION_MS : VOICE_WAKE_SESSION_MS,
    handleTranscript,
    reset,
    startCommandCapture,
  };
}
