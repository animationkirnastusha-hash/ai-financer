import { BadRequestError } from '../../../shared/core/errors';

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

export type TelegramInvoiceInput = {
  title: string;
  description: string;
  payload: string;
  amount: number;
};

export type TelegramSuccessfulPaymentInput = {
  telegramPaymentChargeId?: string;
  providerPaymentChargeId?: string;
  invoicePayload?: string;
  totalAmount?: number;
  currency?: string;
};

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
}

export function isTelegramStarsConfigured() {
  return Boolean(getBotToken());
}

async function callTelegram<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = getBotToken();
  if (!token) throw new BadRequestError('Telegram bot token is not configured');

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as TelegramApiResponse<T> | null;
  if (!response.ok || !payload?.ok) {
    throw new BadRequestError(payload?.description || `Telegram ${method} failed`);
  }

  return payload.result as T;
}

export async function createTelegramStarsInvoiceLink(input: TelegramInvoiceInput): Promise<string> {
  return callTelegram<string>('createInvoiceLink', {
    title: input.title,
    description: input.description,
    payload: input.payload,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: input.title, amount: input.amount }],
  });
}

export async function answerTelegramPreCheckoutQuery(preCheckoutQueryId: string, ok: boolean, errorMessage?: string) {
  return callTelegram<boolean>('answerPreCheckoutQuery', {
    pre_checkout_query_id: preCheckoutQueryId,
    ok,
    ...(ok ? {} : { error_message: errorMessage || 'Платёж не найден' }),
  });
}
