import { AIResult } from './types';

export class AIAdviceService {
  tryBuildAdviceResult(command: string): AIResult | null {
    const normalized = command.trim().toLowerCase().replace(/ё/g, 'е');

    const looksLikeAdvice =
      /(^|\s)(как|что|посоветуй|совет|рекомендац|лучше|почему)(\s|$)/.test(normalized) ||
      normalized.includes('сэконом') ||
      normalized.includes('экономить') ||
      normalized.includes('откладывать') ||
      normalized.includes('отложить') ||
      normalized.includes('накоплен') ||
      normalized.includes('напоминай') ||
      normalized.includes('напомни');

    const looksLikeFinanceCommand =
      /(^|\s)(кофе|такси|еда|магазин|зарплат|доход|расход|переведи|перевод|создай счет|создай счёт)(\s|$)/.test(normalized) &&
      /\d/.test(normalized);

    if (!looksLikeAdvice || looksLikeFinanceCommand) return null;

    return this.buildAdviceResult(command);
  }

  buildAdviceResult(question: string): AIResult {
    const normalized = question.toLowerCase().replace(/ё/g, 'е');

    const wantsSavingRule =
      normalized.includes('откладывать') ||
      normalized.includes('отложить') ||
      normalized.includes('процент') ||
      normalized.includes('%');

    return {
      success: true,
      intent: 'advice',
      executed: false,
      requiresConfirmation: false,
      riskLevel: 'low',
      message: wantsSavingRule
        ? 'Похоже, ты хочешь правило накоплений. Я не буду записывать это как расход. Базово могу помочь создать отдельный накопительный счёт и напоминать про идею. В премиум-логике позже можно сделать автоперевод процента с каждой покупки.'
        : 'Я понял это как финансовый вопрос, а не как операцию. Можешь описать цель, доходы и расходы — я подскажу базовый план. Например: «доход 100к, расходы 70к, хочу накопить 200к».',
      parsed: {
        type: 'advice',
        question,
        suggestion: wantsSavingRule ? 'savings_rule' : 'financial_advice',
      },
    };
  }

  buildClarificationResult(command: string): AIResult {
    return {
      success: false,
      intent: 'unknown',
      executed: false,
      requiresConfirmation: false,
      riskLevel: 'low',
      message:
        'Я не хочу угадывать и записывать деньги неправильно. Уточни команду одним сообщением: «кофе 300», «зарплата 50к», «переведи 1000 с карты на наличные», «создай счёт Копилка».',
      parsed: {
        originalCommand: command,
        examples: ['кофе 300', 'зарплата 50к', 'повтори', 'переведи 1000 с карты на наличные'],
      },
    };
  }
}
