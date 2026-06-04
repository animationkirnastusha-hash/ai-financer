import { AIClarificationRequest, AIValidatedPlan } from './types';

const CLARIFICATION_CODES = new Set([
  'needs_account_clarification',
  'account_not_found',
  'from_account_not_found',
  'to_account_not_found',
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

  build(validated: AIValidatedPlan): AIClarificationRequest | null {
    const issue = validated.issues.find((item) => CLARIFICATION_CODES.has(item.code) && typeof item.actionIndex === 'number');
    if (!issue || typeof issue.actionIndex !== 'number') return null;

    if (issue.code === 'transaction_not_found') {
      return { type: 'transaction', field: 'transaction', actionIndex: issue.actionIndex, question: 'Какую операцию нужно изменить?', createdAt: new Date().toISOString() };
    }

    if (issue.code === 'goal_not_found') {
      return { type: 'goal', field: 'goal', actionIndex: issue.actionIndex, question: 'Какую цель нужно изменить?', createdAt: new Date().toISOString() };
    }

    if (issue.code === 'category_not_found') {
      return { type: 'category', field: 'category', actionIndex: issue.actionIndex, question: 'Какую категорию использовать?', createdAt: new Date().toISOString() };
    }

    if (issue.code === 'section_not_found') {
      return { type: 'section', field: 'section', actionIndex: issue.actionIndex, question: 'Какой раздел использовать?', createdAt: new Date().toISOString() };
    }

    if (issue.code === 'from_account_not_found') {
      return { type: 'account', field: 'fromAccount', actionIndex: issue.actionIndex, question: 'С какого счёта перевести?', createdAt: new Date().toISOString() };
    }

    if (issue.code === 'to_account_not_found') {
      return { type: 'account', field: 'toAccount', actionIndex: issue.actionIndex, question: 'На какой счёт перевести?', createdAt: new Date().toISOString() };
    }

    return { type: 'account', field: 'account', actionIndex: issue.actionIndex, question: 'Какой счёт использовать?', createdAt: new Date().toISOString() };
  }
}
