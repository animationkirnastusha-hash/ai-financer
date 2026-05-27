import { normalizeVoiceTranscriptForStt } from '@/features/voice/model/voiceSttLexicon';
import { VOICE_MIN_COMMAND_TEXT_LENGTH } from '@/features/voice/model/voiceConstants';

export function compactVoiceBubble(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?。！？])\s+/)
    .slice(0, 2)
    .join(' ')
    .slice(0, 118);
}

export function normalizeVoiceText(text: string) {
  return normalizeVoiceTranscriptForStt(text)
    .replace(/[\u00A0\t\r\n]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?]){2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeForWake(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["'«».,!?;:()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shouldIgnoreVoiceCommand(text: string) {
  const normalized = normalizeForWake(text);
  if (!normalized) return true;
  if (normalized.length < VOICE_MIN_COMMAND_TEXT_LENGTH) return true;
  return ['фина', 'финна', 'fina', 'а', 'и', 'ну', 'ээ', 'эм'].includes(normalized);
}
