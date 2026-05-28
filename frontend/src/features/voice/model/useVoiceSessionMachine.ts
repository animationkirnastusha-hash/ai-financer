import { useCallback, useEffect, useRef, useState } from 'react';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import {
  VOICE_AFTER_DISPATCH_COOLDOWN_MS,
  VOICE_MANUAL_SESSION_MS,
} from '@/features/voice/model/voiceConstants';
import type {
  VoiceBubbleTone,
  VoiceCaptureMode,
  VoiceSessionPhase,
  VoiceSessionSegment,
} from '@/features/voice/model/voiceSession.types';
import { normalizeForWake, normalizeVoiceText, shouldIgnoreVoiceCommand } from '@/features/voice/model/voiceText';

type UseVoiceSessionMachineParams = {
  companionName: string;
  showThought: (text: string, tone?: VoiceBubbleTone, timeoutMs?: number) => void;
  dispatchCommand: (params: { sessionId: string; finalText: string; segments: VoiceSessionSegment[] }) => Promise<void>;
};

function makeSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `voice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripOptionalCompanionName(text: string, companionName: string) {
  const cleanText = normalizeVoiceText(text);
  const cleanName = normalizeForWake(companionName || 'Фина');
  const aliases = Array.from(new Set([
    cleanName,
    'фина',
    'финна',
    'фину',
    'фине',
    'финой',
    'fina',
  ].filter(Boolean)));

  let result = cleanText;
  for (const alias of aliases) {
    const pattern = new RegExp(`^\\s*${escapeRegExp(alias)}[\\s,.:;!—-]*`, 'i');
    const normalizedPattern = new RegExp(`^\\s*${escapeRegExp(alias)}[\\s,.:;!—-]*`, 'i');
    if (pattern.test(result)) {
      result = result.replace(pattern, '').trim();
      break;
    }
    const normalized = normalizeForWake(result);
    if (normalizedPattern.test(normalized)) {
      result = result.replace(/^\S+[\s,.:;!—-]*/i, '').trim();
      break;
    }
  }
  return normalizeVoiceText(result);
}

export function useVoiceSessionMachine({ companionName, showThought, dispatchCommand }: UseVoiceSessionMachineParams) {
  const [captureMode, setCaptureMode] = useState<VoiceCaptureMode>('manual');
  const [phase, setPhase] = useState<VoiceSessionPhase>('idle');
  const [isDispatching, setIsDispatching] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const phaseRef = useRef<VoiceSessionPhase>('idle');
  const captureModeRef = useRef<VoiceCaptureMode>('manual');
  const dispatchingRef = useRef(false);
  const cooldownTimerRef = useRef<number | null>(null);

  const setMachinePhase = useCallback((nextPhase: VoiceSessionPhase, nextMode: VoiceCaptureMode = 'manual') => {
    phaseRef.current = nextPhase;
    captureModeRef.current = nextMode;
    setPhase(nextPhase);
    setCaptureMode(nextMode);
    logVoiceDebugEvent('voice_state_changed', { phase: nextPhase, captureMode: nextMode });
  }, []);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const startCooldown = useCallback((durationMs: number, reason: string) => {
    clearCooldownTimer();
    const safeDurationMs = Math.max(0, Math.round(durationMs));
    if (safeDurationMs <= 0) {
      setCooldownUntil(0);
      setMachinePhase('idle', 'manual');
      return;
    }

    const until = Date.now() + safeDurationMs;
    setCooldownUntil(until);
    setMachinePhase('cooldown', 'manual');
    logVoiceDebugEvent('voice_cooldown_started', { reason, durationMs: safeDurationMs, until });

    cooldownTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === 'cooldown') {
        setCooldownUntil(0);
        setMachinePhase('idle', 'manual');
      }
    }, safeDurationMs);
  }, [clearCooldownTimer, setMachinePhase]);

  const reset = useCallback(() => {
    clearCooldownTimer();
    setCooldownUntil(0);
    dispatchingRef.current = false;
    setIsDispatching(false);
    setMachinePhase('idle', 'manual');
  }, [clearCooldownTimer, setMachinePhase]);

  const markHolding = useCallback(() => {
    clearCooldownTimer();
    setCooldownUntil(0);
    setMachinePhase('holding', 'manual');
  }, [clearCooldownTimer, setMachinePhase]);

  const markLocked = useCallback(() => {
    clearCooldownTimer();
    setCooldownUntil(0);
    setMachinePhase('locked', 'locked');
  }, [clearCooldownTimer, setMachinePhase]);

  const markUploading = useCallback(() => {
    setMachinePhase('uploading', captureModeRef.current);
  }, [setMachinePhase]);

  const handleTranscript = useCallback(async (rawText: string) => {
    if (dispatchingRef.current) return;

    const normalized = normalizeVoiceText(rawText);
    if (!normalized || shouldIgnoreVoiceCommand(normalized)) {
      logVoiceDebugEvent('manual_voice_text_ignored', { textLength: normalized.length });
      reset();
      return;
    }

    const finalText = stripOptionalCompanionName(normalized, companionName);

    if (!finalText || shouldIgnoreVoiceCommand(finalText)) {
      logVoiceDebugEvent('manual_voice_command_empty', {
        textLength: normalized.length,
      });
      reset();
      showThought('Не расслышала команду.', 'warning', 2400);
      return;
    }

    const sessionId = makeSessionId();
    const segments: VoiceSessionSegment[] = [{ text: finalText, role: 'initial', at: Date.now() }];

    dispatchingRef.current = true;
    setIsDispatching(true);
    setMachinePhase('dispatching', 'manual');
    logVoiceDebugEvent('manual_voice_session_dispatched', {
      textLength: finalText.length,
      transcriptPreview: finalText.slice(0, 120),
    });
    showThought('Выполняю...', 'thinking', 2200);

    try {
      await dispatchCommand({ sessionId, finalText, segments });
    } finally {
      dispatchingRef.current = false;
      setIsDispatching(false);
      startCooldown(VOICE_AFTER_DISPATCH_COOLDOWN_MS, 'after_manual_dispatch');
    }
  }, [companionName, dispatchCommand, reset, setMachinePhase, showThought, startCooldown]);

  useEffect(() => () => {
    clearCooldownTimer();
  }, [clearCooldownTimer]);

  return {
    captureMode,
    phase,
    isDispatching,
    cooldownUntil,
    recordSessionMs: VOICE_MANUAL_SESSION_MS,
    handleTranscript,
    reset,
    markHolding,
    markLocked,
    markUploading,
  };
}
