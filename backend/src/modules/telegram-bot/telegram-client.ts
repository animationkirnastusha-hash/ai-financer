import { env } from '../../config/env';

type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  web_app?: { url: string };
  url?: string;
};

type ReplyMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramFile = {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  file_path?: string;
};

function getBotToken() {
  return env.telegramBotToken.trim();
}

function getApiUrl(method: string) {
  return `https://api.telegram.org/bot${getBotToken()}/${method}`;
}

async function readTelegramResponse<T>(response: Response): Promise<TelegramApiResponse<T>> {
  const text = await response.text();
  if (!text) return { ok: response.ok };

  try {
    return JSON.parse(text) as TelegramApiResponse<T>;
  } catch {
    return { ok: false, description: text };
  }
}

export class TelegramBotClient {
  private assertConfigured() {
    if (!getBotToken()) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
  }

  async sendMessage(chatId: number | string, text: string, replyMarkup?: ReplyMarkup) {
    this.assertConfigured();

    const response = await fetch(getApiUrl('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    const payload = await readTelegramResponse<unknown>(response);
    if (!response.ok || !payload.ok) {
      throw new Error(payload.description || `Telegram sendMessage failed: ${response.status}`);
    }

    return payload.result;
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    this.assertConfigured();

    const response = await fetch(getApiUrl('answerCallbackQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
      }),
    });

    const payload = await readTelegramResponse<unknown>(response);
    if (!response.ok || !payload.ok) {
      throw new Error(payload.description || `Telegram answerCallbackQuery failed: ${response.status}`);
    }

    return payload.result;
  }

  async getFile(fileId: string) {
    this.assertConfigured();

    const response = await fetch(getApiUrl('getFile'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });

    const payload = await readTelegramResponse<TelegramFile>(response);
    if (!response.ok || !payload.ok || !payload.result?.file_path) {
      throw new Error(payload.description || `Telegram getFile failed: ${response.status}`);
    }

    return payload.result;
  }

  async downloadFile(filePath: string) {
    this.assertConfigured();

    const response = await fetch(`https://api.telegram.org/file/bot${getBotToken()}/${filePath}`);
    if (!response.ok) {
      throw new Error(`Telegram file download failed: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

export const telegramBotClient = new TelegramBotClient();
