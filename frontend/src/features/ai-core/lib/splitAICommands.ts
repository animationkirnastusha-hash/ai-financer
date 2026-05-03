export function splitAICommands(input: string): string[] {
  const normalized = input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*/g, ',')
    .replace(/\s*\n+\s*/g, ',');

  if (!normalized) return [];

  const parts = normalized
    .split(/\s*,\s*|\s+и еще\s+|\s+а еще\s+|\s+плюс еще\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [normalized];
}