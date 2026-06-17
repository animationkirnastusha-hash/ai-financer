function normalizeSpaces(value: string) {
  return value.replace(/[\u00A0\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeVoiceTranscriptForStt(rawText: string) {
  return normalizeSpaces(rawText);
}
