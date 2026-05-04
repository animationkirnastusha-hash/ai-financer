import { env } from '../../config/env';
import { BadRequestError } from '../../shared/core/errors';
import { AIParser } from './parser';
import type { AIParsedCommand } from './types';
import { OllamaProvider } from './providers/ollama.provider';
import { fastFinanceParse } from './fast-finance-interpreter';

const SYSTEM_PROMPT = `
Ты AI-ядро финансового Telegram Mini App AI-financer.

Ты не обычный чат-бот.
Ты financial parser-engine: понимаешь сообщение пользователя и возвращаешь СТРОГО JSON для backend.

Верни ТОЛЬКО JSON.
Никакого markdown.
Никакого текста до JSON.
Никакого текста после JSON.
Никаких комментариев.
Никаких <think>.
Никаких \`\`\`.

Если не понял:
{"intent":"unknown"}

========================
SUPPORTED INTENTS
========================

expense
income
transfer
show_accounts
create_category
create_account
stats
financial_planning
help
unknown

========================
ВАЖНО
========================

Не превращай цели, планы и финансовые модели в расход.

Фразы типа:
- создай цель накопить 100000
- как накопить 500000
- создай финансовую модель
- при зарплате 50000 и расходах 45000 накопить 100000
- хочу скопить к концу года

Это financial_planning, а НЕ expense.

Фразы типа:
- создай долларовый счёт на 5000
- открой счёт в долларах на 5000
- создай карту USD с балансом 5000

Это create_account, а НЕ expense.

========================
СУММЫ
========================

500 = 500
500р = 500
500 руб = 500
5к = 5000
5 тыс = 5000
1.5к = 1500
50к = 50000
2 млн = 2000000

amount всегда number.

========================
EXPENSE
========================

Примеры:
кофе 350
еда 1200
такси 700
купил обувь 9000
заплатил за интернет 600
списали 199

Формат:
{
  "intent":"expense",
  "amount":350,
  "rawCategory":"кофе",
  "description":"кофе",
  "accountName":"карта"
}

Если счёт не указан, не выдумывай accountName.

========================
INCOME
========================

Примеры:
+50000 зарплата
доход 50000
зарплата 120000
пришло 30000
аванс 25000
кэшбек 500
вернули 1200

Формат:
{
  "intent":"income",
  "amount":50000,
  "rawCategory":"зарплата",
  "description":"зарплата",
  "accountName":"основной"
}

Если счёт не указан, не выдумывай accountName.

========================
TRANSFER
========================

Примеры:
переведи 5000 с карты на накопительный
перекинь 1000 с наличных на карту
с карты на инвест 30000

Формат:
{
  "intent":"transfer",
  "amount":5000,
  "fromAccountName":"карта",
  "toAccountName":"накопительный"
}

========================
CREATE_ACCOUNT
========================

Примеры:
создай долларовый счёт на 5000
создай счёт в евро
открой карту RUB на 10000
создай наличный счёт

currency только RUB, USD, EUR.
type только cash, card, savings, investment.

Формат:
{
  "intent":"create_account",
  "name":"Долларовый счёт",
  "type":"card",
  "currency":"USD",
  "balance":5000
}

========================
CREATE_CATEGORY
========================

Пример:
создай категорию кофе

Формат:
{
  "intent":"create_category",
  "name":"кофе",
  "type":"expense"
}

========================
SHOW_ACCOUNTS
========================

Примеры:
покажи счета
мои счета
открой счета

Формат:
{
  "intent":"show_accounts"
}

========================
STATS
========================

Примеры:
сколько потратил на еду
расходы за месяц
доход за март
траты за неделю
статистика кафе

Формат:
{
  "intent":"stats",
  "type":"expense",
  "rawCategory":"еда"
}

========================
FINANCIAL_PLANNING
========================

Примеры:
создай финансовую модель при зарплате 50к и расходах 45к чтобы накопить 100к к концу года
как накопить 500000 за год
если доход 150000 расходы 90000 когда накоплю миллион
хочу выйти на капитал 5 млн
создай цель накопить 100000

Формат:
{
  "intent":"financial_planning",
  "monthlyIncome":50000,
  "monthlyExpenses":45000,
  "targetAmount":100000,
  "targetDateText":"к концу года",
  "question":"создай финансовую модель при зарплате 50к и расходах 45к чтобы накопить 100к к концу года"
}

Если есть только цель без доходов и расходов:
{
  "intent":"financial_planning",
  "targetAmount":100000,
  "question":"создай цель накопить 100000"
}

========================
HELP
========================

Формат:
{
  "intent":"help"
}

========================
UNKNOWN
========================

Формат:
{
  "intent":"unknown"
}

Последнее правило:
верни только один валидный JSON object.
`;

function stripThinkingBlocks(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function extractJsonObject(value: string) {
  const cleaned = stripThinkingBlocks(value);

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('No JSON object found in AI response');
    }

    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as unknown;
  }
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return fallback;
}

function asPositiveNumber(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestError('Invalid amount from AI');
  }

  return amount;
}

function normalizeParsed(input: unknown): AIParsedCommand {
  if (!input || typeof input !== 'object') return { intent: 'unknown' };

  const data = input as Record<string, unknown>;
  const intent = asString(data.intent, 'unknown').toLowerCase();

  if (intent === 'expense' || intent === 'income') {
    const rawCategory = asString(
      data.rawCategory || data.category || data.description,
      intent === 'income' ? 'доход' : 'расход',
    );

    return {
      intent,
      amount: asPositiveNumber(data.amount),
      rawCategory,
      description: asString(data.description, rawCategory),
      accountName: data.accountName ? asString(data.accountName) : undefined,
    };
  }

  if (intent === 'transfer') {
    return {
      intent: 'transfer',
      amount: asPositiveNumber(data.amount),
      fromAccountName: data.fromAccountName
        ? asString(data.fromAccountName)
        : undefined,
      toAccountName: asString(data.toAccountName || data.accountName),
    };
  }

  if (intent === 'show_accounts') return { intent: 'show_accounts' };

  if (intent === 'stats') {
    return {
      intent: 'stats',
      type: data.type === 'income' ? 'income' : 'expense',
      rawCategory: data.rawCategory ? asString(data.rawCategory) : undefined,
    };
  }

  if (intent === 'create_category') {
    return {
      intent: 'create_category',
      name: asString(data.name || data.rawCategory, 'Новая категория'),
      type: data.type === 'income' ? 'income' : 'expense',
    };
  }

  if (intent === 'create_account') {
    const type = asString(data.type, 'card').toLowerCase();
    const currency = asString(data.currency, 'RUB').toUpperCase();

    return {
      intent: 'create_account',
      name: asString(data.name, 'Новый счёт'),
      type: ['cash', 'card', 'savings', 'investment'].includes(type)
        ? type
        : 'card',
      currency: ['RUB', 'USD', 'EUR'].includes(currency) ? currency : 'RUB',
      balance: Number(data.balance) || 0,
    };
  }
  if (intent === 'financial_planning') {
    return {
      intent: 'financial_planning',
      monthlyIncome: data.monthlyIncome ? Number(data.monthlyIncome) : undefined,
      monthlyExpenses: data.monthlyExpenses ? Number(data.monthlyExpenses) : undefined,
      targetAmount: data.targetAmount ? Number(data.targetAmount) : undefined,
      targetDateText: data.targetDateText ? asString(data.targetDateText) : undefined,
      question: asString(data.question || data.description, ''),
    };
  }
  if (intent === 'help') return { intent: 'help' };

  return { intent: 'unknown' };
}

export class LLMCommandInterpreter {
  private readonly fallbackParser = new AIParser();
  private readonly ollama = new OllamaProvider();
private pickModel(command: string) {
    const normalized = command.toLowerCase();

    const isPlanning =
      normalized.includes('финансов') ||
      normalized.includes('модель') ||
      normalized.includes('накоп') ||
      normalized.includes('скоп') ||
      normalized.includes('план') ||
      normalized.includes('цель') ||
      normalized.includes('прогноз');

    if (isPlanning) {
      return env.ollamaFreeReasoningModel;
    }

    return env.ollamaFastModel;
  }
  async parse(
  command: string,
  history: Array<{ role: string; content: string }> = []
): Promise<AIParsedCommand> {
  
    const trimmed = command.trim();

    if (!trimmed) {
      throw new BadRequestError('Command is required');
    }

    const fastResult = fastFinanceParse(trimmed);
    if (fastResult) return fastResult;

    if (env.aiMode !== 'ollama') {
      return this.fallbackParser.parse(command);
    }

    try {
      const response = await this.ollama.complete({
  model: this.pickModel(trimmed),
  temperature: 0.03,
  messages: [
  {
    role: 'system',
    content:
      SYSTEM_PROMPT +
      `

========================
DIALOG MEMORY
========================

Последние сообщения пользователя и AI:
${history
  .map((message) => `${message.role === 'user' ? 'Пользователь' : 'AI'}: ${message.content}`)
  .join('\n')}

Правила памяти:
- если пользователь пишет "ещё", "ещё раз", "то же самое", используй предыдущую похожую операцию
- если пользователь пишет сумму без категории, используй последнюю категорию расхода/дохода
- не выдумывай счёт, если его не было в истории
- всё равно верни только JSON
`,
  },
  { role: 'user', content: trimmed },
],
      });

      return normalizeParsed(extractJsonObject(response.content));
    } catch (error) {
      console.error('Ollama parse failed. Falling back:', error);

      const fallbackResult = fastFinanceParse(trimmed);
      if (fallbackResult) return fallbackResult;

      return this.fallbackParser.parse(command);
    }
  }
}