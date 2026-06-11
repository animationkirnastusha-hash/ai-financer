import { normalizeForWake, normalizeVoiceText } from '@/features/voice/model/voiceText';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripOptionalCompanionName(text: string, companionName: string) {
  const cleanText = normalizeVoiceText(text);
  const cleanName = normalizeForWake(companionName || 'Фина');
  const aliases = Array.from(
    new Set(
      [cleanName, 'фина', 'финна', 'фину', 'фине', 'финой', 'fina'].filter(
        Boolean,
      ),
    ),
  );

  for (const alias of aliases) {
    const pattern = new RegExp(`^\\s*${escapeRegExp(alias)}[\\s,.:;!—-]*`, 'i');
    if (pattern.test(cleanText))
      return normalizeVoiceText(cleanText.replace(pattern, ''));
  }

  return cleanText;
}

export function formatAmount(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(
    amount,
  );
}

export function pickRotatingStatus(
  t: (key: string, params?: Record<string, string | number>) => string,
  group: 'listening' | 'thinking' | 'ready' | 'confirm',
  seed = 0,
) {
  const variants =
    group === 'listening'
      ? [
          'textChat.status.listening.a',
          'textChat.status.listening.b',
          'textChat.status.listening.c',
        ]
      : group === 'thinking'
        ? [
            'textChat.status.thinking.a',
            'textChat.status.thinking.b',
            'textChat.status.thinking.c',
          ]
        : group === 'confirm'
          ? [
              'textChat.status.confirm.a',
              'textChat.status.confirm.b',
              'textChat.status.confirm.c',
            ]
          : [
              'textChat.status.ready.a',
              'textChat.status.ready.b',
              'textChat.status.ready.c',
            ];
  return t(variants[Math.abs(seed) % variants.length]);
}

export function chooseAccountName(
  accounts: Array<{ name?: string | null; type?: string | null }>,
) {
  const preferred =
    accounts.find((account) => String(account.type).toLowerCase() === 'cash') ??
    accounts.find((account) =>
      String(account.name ?? '')
        .toLowerCase()
        .includes('нал'),
    ) ??
    accounts.find((account) =>
      String(account.name ?? '')
        .toLowerCase()
        .includes('карт'),
    ) ??
    accounts[0];
  return preferred?.name?.trim() || '';
}
