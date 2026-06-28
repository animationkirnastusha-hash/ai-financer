const VOICE_MIN_COMMAND_TEXT_LENGTH = 2;

function normalizeSpaces(value: string) {
  return value.replace(/[\u00A0\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function compactVoiceBubble(text: string) {
  return normalizeVoiceText(text)
    .split(/(?<=[.!?。！？])\s+/)
    .slice(0, 2)
    .join(' ')
    .slice(0, 118);
}

export function normalizeVoiceText(text: string) {
  return normalizeSpaces(text)
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?]){2,}/g, '$1')
    .trim();
}

export function normalizeForVoiceText(text: string) {
  return normalizeSpaces(text)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["'«».,!?;:()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shouldIgnoreVoiceCommand(text: string) {
  const normalized = normalizeForVoiceText(text);
  if (!normalized) return true;
  if (normalized.length < VOICE_MIN_COMMAND_TEXT_LENGTH) return true;
  return ['а', 'и', 'ну', 'ээ', 'эм'].includes(normalized);
}
