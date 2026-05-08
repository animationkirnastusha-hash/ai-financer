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
AI-NATIVE MULTI ACTION MODE
========================

Пользователь может говорить естественно, не командами.
Твоя задача — понять намерение и разложить сообщение на backend-действия.
Не заставляй пользователя подбирать слова.

Если в одном сообщении несколько действий, верни:
{
  "intent":"batch",
  "summary":"коротко что будет сделано",
  "actions":[ ... ]
}

Примеры:
"Создай счет Наличка и положи туда 50 тысяч рублей"
{
  "intent":"batch",
  "summary":"создать счет Наличка и записать доход 50000 на него",
  "actions":[
    {"intent":"create_account","name":"Наличка","type":"cash","currency":"RUB","balance":0},
    {"intent":"income","amount":50000,"rawCategory":"пополнение","description":"пополнение счета Наличка","accountName":"Наличка"}
  ]
}

"Создай раздел Дом, категорию продукты и запиши туда магнит 1200"
{
  "intent":"batch",
  "summary":"создать структуру Дом/продукты и записать расход",
  "actions":[
    {"intent":"create_section","name":"Дом"},
    {"intent":"create_category","name":"продукты","type":"expense","sectionName":"Дом"},
    {"intent":"expense","amount":1200,"rawCategory":"продукты","description":"магнит","sectionName":"Дом"}
  ]
}

"Положи 50к на наличку" = income на счет наличка.
"Закинь 10 тысяч на карту" = income на счет карта.
"Сними 5000 с карты в наличку" = transfer с карты на наличку.
"Купил продуктов в дом на 1500" = expense, rawCategory продукты, sectionName Дом.

Базовая версия должна делать все доступные ручные действия через AI:
- создать/изменить счета, категории, разделы;
- записать доход, расход, перевод;
- распределить расходы по разделам;
- показать счета и базовую статистику.

Если запрос содержит premium-часть, НЕ отказывайся.
Сделай базовую часть запроса, а premium-часть можешь описать как рекомендацию в message/summary только если она не требует backend-действия.

========================
SUPPORTED INTENTS
========================

expense
income
transfer
show_accounts
create_category
create_section
assign_expenses_to_section
create_account
stats
financial_planning
advice
repeat_last
help
unknown
batch

========================
ВАЖНО
========================

Не превращай цели, планы, советы, напоминания и финансовые модели в расход.

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
Если пользователь явно пишет "в раздел Дом", добавь "sectionName":"Дом".

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
Если пользователь явно пишет "в раздел Дом", добавь "sectionName":"Дом".

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
ADVICE
========================

Если пользователь просит совет, объяснение, рекомендацию, напоминание, идею накоплений или спрашивает "как лучше", это advice, а НЕ expense.

Примеры:
как сэкономить на еде
напоминай мне откладывать 5 процентов с покупок
что делать чтобы меньше тратить
как лучше вести бюджет
посоветуй как копить

Формат:
{
  "intent":"advice",
  "question":"как сэкономить на еде"
}

Важно: advice не создаёт транзакции и не меняет счета.

========================
REPEAT_LAST
========================

Используй repeat_last, когда пользователь просит повторить последнюю операцию без новых деталей.

Примеры:
еще
ещё
повтори
повтори еще раз
сделай так же
то же самое
добавь такую же
запиши так же
можно еще одну

Формат:
{
  "intent":"repeat_last"
}

Важно: если пользователь явно указал новую сумму и категорию, это НЕ repeat_last, а expense/income.

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
верни один валидный JSON object. Если в сообщении несколько действий — верни batch.
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


function normalizeAction(input: unknown): AIParsedCommand {
  const parsed = normalizeParsed(input);
  if (parsed.intent === 'batch') {
    return { intent: 'unknown' };
  }
  return parsed;
}

function isExecutableBatchAction(action: AIParsedCommand): action is Exclude<AIParsedCommand, { intent: 'batch' } | { intent: 'unknown' }> {
  return action.intent !== 'batch' && action.intent !== 'unknown';
}

function normalizeParsed(input: unknown): AIParsedCommand {
  if (!input || typeof input !== 'object') return { intent: 'unknown' };

  const data = input as Record<string, unknown>;
  const intent = asString(data.intent, 'unknown').toLowerCase();

  if (intent === 'batch') {
    const rawActions = Array.isArray(data.actions) ? data.actions : [];
    const actions = rawActions.map(normalizeAction).filter(isExecutableBatchAction);

    if (actions.length === 0) {
      return { intent: 'unknown' };
    }

    return {
      intent: 'batch',
      actions,
      summary: data.summary ? asString(data.summary) : undefined,
    };
  }

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
      sectionName: data.sectionName ? asString(data.sectionName) : undefined,
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

  if (intent === 'repeat_last') return { intent: 'repeat_last' };

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
      sectionName: data.sectionName ? asString(data.sectionName) : undefined,
    } as AIParsedCommand;
  }

  if (intent === 'create_section') {
    return {
      intent: 'create_section',
      name: asString(data.name || data.sectionName, 'Новый раздел'),
    };
  }

  if (intent === 'assign_expenses_to_section') {
    return {
      intent: 'assign_expenses_to_section',
      rawQuery: asString(data.rawQuery || data.category || data.description, ''),
      sectionName: asString(data.sectionName || data.name, 'Новый раздел'),
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
  if (intent === 'advice') {
    return {
      intent: 'advice',
      question: asString(data.question || data.description, ''),
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
  if (intent === 'repeat_last') return { intent: 'repeat_last' };

  if (intent === 'help') return { intent: 'help' };

  return { intent: 'unknown' };
}


function parseHumanMoneyAmount(raw: string): number | null {
  const normalized = raw.toLowerCase().replace(',', '.').replace(/\s+/g, ' ').trim();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(к|тыс|тысяч|млн|миллион|миллиона|миллионов)?/i);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base) || base <= 0) return null;
  const unit = match[2] ?? '';
  if (/^(к|тыс|тысяч)$/i.test(unit)) return base * 1000;
  if (/^(млн|миллион|миллиона|миллионов)$/i.test(unit)) return base * 1000000;
  return base;
}

function inferAccountType(name: string, command: string) {
  const value = `${name} ${command}`.toLowerCase().replace(/ё/g, 'е');
  if (/налич|кэш|cash/.test(value)) return 'cash';
  if (/копил|накоп|сбер|saving/.test(value)) return 'savings';
  if (/инвест|брокер/.test(value)) return 'investment';
  return 'card';
}

function parseNaturalCompositeFallback(command: string): AIParsedCommand | null {
  const normalized = command.trim().replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase().replace(/ё/g, 'е');

  const createAndPut = lower.match(/(?:создай|открой)\s+счет\s+(.+?)\s+(?:и\s+)?(?:положи|закинь|пополн|добавь|внеси)\s+(?:туда\s+|на\s+него\s+|в\s+него\s+)?(.+?)(?:\s+руб|\s+рублей|$)/i);
  if (createAndPut) {
    const name = createAndPut[1].trim().replace(/[.,!?]+$/g, '');
    const amount = parseHumanMoneyAmount(createAndPut[2]);
    if (name && amount) {
      return {
        intent: 'batch',
        summary: `Создать счёт «${name}» и записать на него доход ${amount}`,
        actions: [
          { intent: 'create_account', name, type: inferAccountType(name, lower), currency: 'RUB', balance: 0 },
          { intent: 'income', amount, rawCategory: 'пополнение', description: `пополнение счёта ${name}`, accountName: name },
        ],
      };
    }
  }

  const putToAccount = lower.match(/(?:положи|закинь|пополн|добавь|внеси)\s+(.+?)\s+(?:на|в)\s+(?:счет\s+)?(.+)$/i);
  if (putToAccount) {
    const amount = parseHumanMoneyAmount(putToAccount[1]);
    const accountName = putToAccount[2].trim().replace(/[.,!?]+$/g, '');
    if (amount && accountName) {
      return {
        intent: 'income',
        amount,
        rawCategory: 'пополнение',
        description: `пополнение счёта ${accountName}`,
        accountName,
      };
    }
  }

  return null;
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
    history: Array<{ role: string; content: string }> = [],
  ): Promise<AIParsedCommand> {
    const trimmed = command.trim();

    if (!trimmed) {
      throw new BadRequestError('Command is required');
    }

    const naturalComposite = parseNaturalCompositeFallback(trimmed);
    if (naturalComposite) return naturalComposite;

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
- если пользователь просит повторить действие: верни {"intent":"repeat_last"}
- если пользователь пишет «ещё 200» после «кофе 350», это расход на ту же категорию с новой суммой
- если пользователь пишет только «ещё», «повтори», «так же», «то же самое», это repeat_last
- не выдумывай счёт, если его не было в истории
- верни только JSON
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