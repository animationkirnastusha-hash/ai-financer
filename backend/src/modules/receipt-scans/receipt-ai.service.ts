export type ReceiptAiItem = {
  title: string;
  amount: number | null;
  quantity?: string | null;
  categoryHint?: string | null;
};

export type ReceiptAiResult = {
  merchant: string | null;
  totalAmount: number | null;
  currency: string;
  purchasedAt: Date | null;
  rawText: string | null;
  items: ReceiptAiItem[];
  confidence: number;
};

type OpenAIReceiptPayload = {
  merchant?: unknown;
  totalAmount?: unknown;
  total_amount?: unknown;
  currency?: unknown;
  purchasedAt?: unknown;
  purchased_at?: unknown;
  date?: unknown;
  rawText?: unknown;
  raw_text?: unknown;
  confidence?: unknown;
  items?: Array<{
    title?: unknown;
    name?: unknown;
    amount?: unknown;
    totalAmount?: unknown;
    total_amount?: unknown;
    price?: unknown;
    quantity?: unknown;
    category?: unknown;
    categoryHint?: unknown;
    category_hint?: unknown;
  }>;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
    code?: string | number;
  };
};

const VISION_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const DEFAULT_RECEIPT_OCR_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 45_000;

function normalizeMimeType(value: string) {
  return String(value || '').toLowerCase().trim();
}

function cleanText(value: unknown, max = 160): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max).trim() : null;
}

function normalizeCurrency(value: unknown) {
  const currency = String(value || 'RUB').trim().toUpperCase();
  if (currency === 'RUR' || currency === '₽' || currency === 'РУБ') return 'RUB';
  if (/^[A-Z]{3}$/.test(currency)) return currency;
  return 'RUB';
}

function normalizeAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }

  const text = String(value)
    .replace(/\s+/g, '')
    .replace(/[₽ррубRUB]/gi, '')
    .replace(',', '.')
    .trim();
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function normalizeDate(value: unknown): Date | null {
  const text = cleanText(value, 64);
  if (!text) return null;
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampConfidence(value: unknown) {
  const parsed = Number(value ?? 0.6);
  if (!Number.isFinite(parsed)) return 0.6;
  return Math.min(1, Math.max(0, parsed));
}

function stripCodeFences(value: string) {
  return value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}

function extractJson(value: string) {
  const cleaned = stripCodeFences(value || '');
  if (!cleaned) return '';
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  return first >= 0 && last > first ? cleaned.slice(first, last + 1) : '';
}

function normalizeItems(items: OpenAIReceiptPayload['items']): ReceiptAiItem[] {
  if (!Array.isArray(items)) return [];

  const normalized: ReceiptAiItem[] = [];

  for (const item of items) {
    const title = cleanText(item.title ?? item.name, 120);
    if (!title) continue;
    const amount = normalizeAmount(item.totalAmount ?? item.total_amount ?? item.amount ?? item.price);
    normalized.push({
      title,
      amount,
      quantity: cleanText(item.quantity, 40),
      categoryHint: cleanText(item.categoryHint ?? item.category_hint ?? item.category, 80),
    });
    if (normalized.length >= 60) break;
  }

  return normalized;
}

function buildRawText(payload: OpenAIReceiptPayload, items: ReceiptAiItem[]) {
  const explicit = cleanText(payload.rawText ?? payload.raw_text, 4000);
  if (explicit) return explicit;
  if (!items.length) return null;
  return items
    .map((item) => [item.title, item.amount ?? ''].filter((part) => part !== '').join(' '))
    .join('\n')
    .slice(0, 4000);
}

async function readError(response: Response) {
  try {
    const text = await response.text();
    if (!text) return response.statusText;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: string | number }; message?: string };
      return parsed.error?.message || parsed.error?.code || parsed.message || text;
    } catch {
      return text;
    }
  } catch {
    return response.statusText;
  }
}

export class ReceiptAiService {
  canAnalyze(mimeType: string) {
    return VISION_MIME_TYPES.has(normalizeMimeType(mimeType));
  }

  async analyze(input: { buffer: Buffer; mimeType: string; fileName: string }): Promise<ReceiptAiResult | null> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const mimeType = normalizeMimeType(input.mimeType);

    if (!apiKey || !this.canAnalyze(mimeType) || input.buffer.length <= 0) return null;

    const controller = new AbortController();
    const timeoutMs = Number(process.env.RECEIPT_OCR_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);
    const model = process.env.RECEIPT_OCR_MODEL?.trim() || process.env.OPENAI_VISION_MODEL?.trim() || DEFAULT_RECEIPT_OCR_MODEL;
    const imageUrl = `data:${mimeType};base64,${input.buffer.toString('base64')}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 1400,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: [
                'You extract structured data from consumer receipts for a personal finance app.',
                'Return JSON only. Do not invent data that is not visible on the receipt.',
                'Amounts must be numbers in the receipt currency. For ruble receipts use RUB.',
                'Prefer the final payable total over subtotal/discount lines.',
                'Items should be real purchased lines, not fiscal metadata, tax IDs, addresses, cashier names, QR data or legal footers.',
                'If the image is unreadable, return null values and an empty items array with low confidence.',
              ].join(' '),
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: [
                    `File name: ${input.fileName}`,
                    'Extract this receipt into JSON with this shape:',
                    '{"merchant":string|null,"totalAmount":number|null,"currency":"RUB"|"USD"|"EUR"|string,"purchasedAt":"YYYY-MM-DD"|null,"items":[{"title":string,"quantity":string|null,"amount":number|null,"categoryHint":string|null}],"rawText":string|null,"confidence":number}',
                    'Use Russian item titles if the receipt is Russian. Keep categoryHint short and semantic, for example: продукты, кафе, авто, аптека, дом, связь.',
                  ].join('\n'),
                },
                { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await readError(response);
        console.warn('[receipt-ai] OpenAI receipt analysis failed', { status: response.status, reason: error });
        return null;
      }

      const payload = (await response.json()) as OpenAIChatResponse;
      if (payload.error) {
        console.warn('[receipt-ai] OpenAI receipt analysis error', { reason: payload.error.message || payload.error.code });
        return null;
      }

      const raw = payload.choices?.[0]?.message?.content ?? '';
      const json = extractJson(raw);
      if (!json) return null;

      const parsed = JSON.parse(json) as OpenAIReceiptPayload;
      const items = normalizeItems(parsed.items);
      const itemTotal = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      const totalAmount = normalizeAmount(parsed.totalAmount ?? parsed.total_amount) ?? (itemTotal > 0 ? Math.round(itemTotal) : null);
      const rawText = buildRawText(parsed, items);
      const merchant = cleanText(parsed.merchant, 120);
      const purchasedAt = normalizeDate(parsed.purchasedAt ?? parsed.purchased_at ?? parsed.date);
      const confidence = clampConfidence(parsed.confidence);

      if (!merchant && !totalAmount && !purchasedAt && !rawText && items.length === 0) {
        return null;
      }

      return {
        merchant,
        totalAmount,
        currency: normalizeCurrency(parsed.currency),
        purchasedAt,
        rawText,
        items,
        confidence,
      };
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError'
        ? `timeout after ${timeoutMs}ms`
        : error instanceof Error ? error.message : String(error);
      console.warn('[receipt-ai] receipt analysis skipped', { reason: message });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const receiptAiService = new ReceiptAiService();
