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


  buildRetryMessage(clarification: AIClarificationRequest, candidate: string) {
    const suffix = this.shortCandidateLabel(candidate);

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

  private shortCandidateLabel(value: string) {
    const clean = value.trim().replace(/\s+/g, ' ');
    if (!clean) return '';
    return clean.length > 32 ? `${clean.slice(0, 29).trim()}...` : clean;
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
