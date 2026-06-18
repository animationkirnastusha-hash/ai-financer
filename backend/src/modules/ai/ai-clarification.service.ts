import { AILanguage } from './ai-language.service';
import { AIClarificationRequest, AIValidatedAction, AIValidatedPlan } from './types';

const CLARIFICATION_CODES = new Set([
  'missing_account_setup_details',
  'missing_account_name',
  'missing_account_balance',
  'needs_first_account_setup',
  'needs_account_clarification',
  'account_not_found',
  'from_account_not_found',
  'to_account_not_found',
  'missing_amount',
  'missing_goal_target',
  'goal_not_found',
  'category_not_found',
  'section_not_found',
  'transaction_not_found',
]);

export class AIClarificationService {
  looksLikeNewCommand(answer: string): boolean {
    const text = answer.toLowerCase().replace(/ё/g, 'е');
    const hasAmount = /\b\d+[\d\s.,]*(к|k|тыс|руб|₽|доллар|евро)?\b/.test(text);
    const hasActionVerb = /\b(созда[йть]|добав[ьить]|запиши|спиши|потрат|расход|доход|положи|переведи|перенеси|удали|измени|переименуй|сделай|отмени|покажи|открой|закрой|купи|оплатил|получил|заработал)\b/.test(text);
    const hasFinancialObject = /\b(счет|сч[её]т|карта|налич|категор|раздел|цель|операци|расход|доход|перевод|валют)\b/.test(text);
    return hasActionVerb || (hasAmount && hasFinancialObject);
  }

  buildRetryMessage(clarification: AIClarificationRequest, candidate: string) {
    const suffix = this.shortCandidateLabel(candidate);

    if (clarification.type === 'account_setup') {
      return suffix
        ? `Не получилось создать первый счёт по ответу (${suffix}). Напишите название и текущий баланс, например: Наличка 5000.`
        : 'Не получилось создать первый счёт. Напишите название и текущий баланс, например: Наличка 5000.';
    }

    if (clarification.type === 'amount') {
      return suffix
        ? `Не поняла сумму (${suffix}). Напишите только сумму, например: 350.`
        : 'Не поняла сумму. Напишите только сумму, например: 350.';
    }

    if (clarification.type === 'account') {
      return suffix
        ? `Не смогла сопоставить это со счётом (${suffix}). Напиши название счёта из списка или выбери его вручную.`
        : 'Не смогла сопоставить это со счётом. Напиши название счёта из списка или выбери его вручную.';
    }

    if (clarification.type === 'goal') {
      return suffix
        ? `Не смогла сопоставить это с целью (${suffix}). Напиши название цели чуть точнее.`
        : 'Не смогла сопоставить это с целью. Напиши название цели чуть точнее.';
    }

    if (clarification.type === 'category') {
      return suffix
        ? `Не смогла сопоставить это с категорией (${suffix}). Напиши название категории чуть точнее.`
        : 'Не смогла сопоставить это с категорией. Напиши название категории чуть точнее.';
    }

    if (clarification.type === 'section') {
      return suffix
        ? `Не смогла сопоставить это с разделом (${suffix}). Напиши название раздела чуть точнее.`
        : 'Не смогла сопоставить это с разделом. Напиши название раздела чуть точнее.';
    }

    return 'Не смогла сопоставить уточнение с нужными данными. Напиши короче и точнее.';
  }

  build(validated: AIValidatedPlan, language: AILanguage = 'ru'): AIClarificationRequest | null {
    const priorityCodes = [
      'missing_amount',
      'missing_goal_target',
      'missing_account_setup_details',
      'missing_account_name',
      'missing_account_balance',
      'needs_first_account_setup',
      'needs_account_clarification',
      'account_not_found',
      'from_account_not_found',
      'to_account_not_found',
      'goal_not_found',
      'category_not_found',
      'section_not_found',
      'transaction_not_found',
    ];

    const issue = priorityCodes
      .map((code) => validated.issues.find((item) => item.code === code && typeof item.actionIndex === 'number'))
      .find(Boolean)
      ?? validated.issues.find((item) => CLARIFICATION_CODES.has(item.code) && typeof item.actionIndex === 'number');
    if (!issue || typeof issue.actionIndex !== 'number') return null;

    const action = validated.actions[issue.actionIndex];

    if (issue.code === 'needs_first_account_setup' || issue.code === 'missing_account_setup_details' || issue.code === 'missing_account_name' || issue.code === 'missing_account_balance') {
      return {
        type: 'account_setup',
        field: 'accountSetup',
        actionIndex: issue.actionIndex,
        question: issue.code === 'needs_first_account_setup'
          ? this.phrase(language, 'Сначала нужен счёт. Напишите название и текущий баланс, например: Наличка 5000.', 'First we need an account. Send its name and current balance, for example: Cash 5000.')
          : this.phrase(language, 'Как назовём счёт и какой сейчас баланс? Например: Наличка 5000.', 'What should we call the account, and what is the current balance? For example: Cash 5000.'),
        createdAt: new Date().toISOString(),
      };
    }

    if (issue.code === 'missing_amount') {
      return {
        type: 'amount',
        field: 'amount',
        actionIndex: issue.actionIndex,
        question: this.amountQuestion(action, language),
        createdAt: new Date().toISOString(),
      };
    }

    if (issue.code === 'missing_goal_target') {
      return {
        type: 'amount',
        field: 'targetAmount',
        actionIndex: issue.actionIndex,
        question: this.phrase(language, 'На какую сумму создать цель?', 'What target amount should I use for the goal?'),
        createdAt: new Date().toISOString(),
      };
    }

    if (issue.code === 'transaction_not_found') {
      return { type: 'transaction', field: 'transaction', actionIndex: issue.actionIndex, question: this.phrase(language, 'Какую операцию нужно изменить?', 'Which transaction should I update?'), createdAt: new Date().toISOString() };
    }

    if (issue.code === 'goal_not_found') {
      return { type: 'goal', field: 'goal', actionIndex: issue.actionIndex, question: this.phrase(language, 'Какую цель нужно изменить?', 'Which goal should I update?'), createdAt: new Date().toISOString() };
    }

    if (issue.code === 'category_not_found') {
      return { type: 'category', field: 'category', actionIndex: issue.actionIndex, question: this.phrase(language, 'Какую категорию использовать?', 'Which category should I use?'), createdAt: new Date().toISOString() };
    }

    if (issue.code === 'section_not_found') {
      return { type: 'section', field: 'section', actionIndex: issue.actionIndex, question: this.phrase(language, 'Какой раздел использовать?', 'Which section should I use?'), createdAt: new Date().toISOString() };
    }

    if (issue.code === 'from_account_not_found') {
      return { type: 'account', field: 'fromAccount', actionIndex: issue.actionIndex, question: this.phrase(language, 'С какого счёта перевести?', 'Which account should I transfer from?'), createdAt: new Date().toISOString() };
    }

    if (issue.code === 'to_account_not_found') {
      return { type: 'account', field: 'toAccount', actionIndex: issue.actionIndex, question: this.phrase(language, 'На какой счёт перевести?', 'Which account should I transfer to?'), createdAt: new Date().toISOString() };
    }

    return { type: 'account', field: 'account', actionIndex: issue.actionIndex, question: this.phrase(language, 'Какой счёт использовать?', 'Which account should I use?'), createdAt: new Date().toISOString() };
  }

  private amountQuestion(action: AIValidatedAction | undefined, language: AILanguage) {
    const tool = String(action?.tool ?? '');
    const input = action?.input ?? {};

    if (tool === 'create_goal') return this.phrase(language, 'На какую сумму создать цель?', 'What target amount should I use for the goal?');
    if (tool === 'transfer_money') return this.phrase(language, 'Какую сумму перевести?', 'How much should I transfer?');
    if (tool === 'create_transaction') {
      return input.kind === 'income'
        ? this.phrase(language, 'Какая сумма дохода?', 'What is the income amount?')
        : this.phrase(language, 'Сколько потратили?', 'How much did you spend?');
    }

    return this.phrase(language, 'Какая сумма?', 'What amount should I use?');
  }

  private phrase(language: AILanguage, ru: string, en: string) {
    return language === 'en' ? en : ru;
  }

  private shortCandidateLabel(value: string) {
    const clean = value.trim().replace(/\s+/g, ' ');
    if (!clean) return '';
    return clean.length > 32 ? `${clean.slice(0, 29).trim()}...` : clean;
  }
}
