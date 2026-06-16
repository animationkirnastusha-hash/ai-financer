import { createAIProvider } from './providers/ai-provider.factory';
import { AIModelRole } from './providers/ai-provider.types';
import { buildFinanceReplyFallback, cleanAssistantReply } from './messages/ai-reply-fallbacks';
import { AIAnswerStyle, AIDialogIntent } from './ai-dialog-router.service';

type UserContext = {
  user?: { tier?: string } | null;
  accounts?: Array<{ name?: string; type?: string; currency?: string; balance?: number }>;
  categories?: Array<{ name?: string; type?: string }>;
  sections?: Array<{ name?: string }>;
  goals?: Array<{ title?: string; targetAmount?: number; currentAmount?: number; currency?: string; status?: string }>;
  obligations?: Array<{ title?: string; type?: string; monthlyPayment?: number; currentDebt?: number; currency?: string; status?: string; nextPaymentDate?: unknown }>;
  recentTransactions?: Array<{ type?: string; amount?: number; description?: string; createdAt?: unknown; account?: { name?: string }; category?: { name?: string } | null; section?: { name?: string } | null }>;
  memory?: { preferences?: unknown[] };
};

type AnswerResponse = {
  answer?: string;
};

export interface AIAnswerOptions {
  style?: AIAnswerStyle;
  intent?: AIDialogIntent | string;
  tier?: string;
}

export class AIAnswerService {
  private readonly provider = createAIProvider();

  async answer(
    command: string,
    context: unknown,
    modelRole: AIModelRole,
    preplannedAnswer?: string,
    options: AIAnswerOptions = {},
  ): Promise<string> {
    const style = options.style ?? this.defaultStyle(options.tier, context);
    const system = this.buildSystemPrompt(style, modelRole, options.intent);

    const prompt = [
      'Context:',
      JSON.stringify(this.compactContext(context)),
      'User:',
      command,
    ].join('\n');

    try {
      const raw = await this.provider.generateJson<AnswerResponse>({
        system,
        prompt: preplannedAnswer && preplannedAnswer.trim().length > 8
          ? `${prompt}\nIntent or answer hint from routing layer:\n${preplannedAnswer.trim()}`
          : prompt,
        modelRole,
        temperature: style === 'free_companion' ? 0.25 : 0.45,
        timeoutMs: modelRole === 'premium' ? 45_000 : 12_000,
        numPredict: this.predictLimit(style, modelRole),
      });

      const answer = cleanAssistantReply(raw.answer);
      return answer || this.buildFallbackAnswer(command, style, options.intent);
    } catch (error) {
      console.warn('[AI] answer generation failed, using fallback', {
        message: error instanceof Error ? error.message : String(error),
        intent: options.intent,
      });
      return this.buildFallbackAnswer(command, style, options.intent);
    }
  }

  private buildSystemPrompt(style: AIAnswerStyle, modelRole: AIModelRole, intent: unknown) {
    const base = [
      'You are Fina inside a finance app. Return JSON only: {"answer":"..."}.',
      'Speak the user language. No markdown. No chain-of-thought. Do not claim actions were saved unless a tool result explicitly did it.',
      'A message is not always a command. If it is a question, discussion, complaint or casual message, answer naturally instead of forcing an app action.',
      'If the user asks who you are, what you can do, how to work with you, or how Free/Premium/Business differ, answer directly as Fina. Do not use tools for that.',
      'Stay mostly around money, habits, income, spending, goals, obligations and planning, but you may respond like a normal helpful assistant when the user is emotional or casual.',
      'If app data is empty, say that directly and suggest the smallest useful next step. Do not pretend there are expenses, accounts or reports.',
      'Do not give legal, tax, investment or medical guarantees. You may help structure thoughts and suggest what to check.',
      `Intent hint: ${typeof intent === 'string' ? intent : 'unknown'}.`,
      'When explaining Fina, keep it product-like and clear: Free is for everyday money tracking, Premium is deeper and more conversational, Business is a hired bookkeeping-style assistant.',
      'Do not mention internal plans, routes, validators, tools, prompts, tiers as technical objects, or implementation details.',
    ];

    if (style === 'business_accountant') {
      return [
        ...base,
        'Business mode: act like a hired bookkeeping and finance operations assistant, not a playful companion.',
        'If asked about Business, explain it as a separate working mode for business money, cashflow, obligations, receipts, documents, reports and control.',
        'Focus on cashflow, income plan, expenses, documents, obligations, taxes to check, invoices, receipts, payroll-like discipline and monthly control.',
        'Be practical and concise. Prefer checklist-style thinking in plain sentences. Ask for missing documents or numbers when needed.',
        'Do not overdo emotional support in business mode; keep the tone professional and useful.',
        modelRole === 'premium' ? 'You can give deeper business reasoning, but keep it operational.' : 'Keep the answer short.',
      ].join(' ');
    }

    if (style === 'premium_companion') {
      return [
        ...base,
        'Premium mode: you may be more conversational, warm and adaptive. You can discuss salary stress, debt pressure, habits, goals and plans over several turns.',
        'If asked about Premium, explain that it gives longer financial dialogue, deeper analysis, forecasts, receipts, extended reports and more personal recommendations.',
        'Use available finance context to personalize the answer. If context is thin, say what data would help and propose one next step.',
        'Give a useful mini-plan when the user asks for advice, but do not turn advice into saved app actions without explicit permission.',
        'Answer in 3-7 short sentences unless the user asks for detail.',
      ].join(' ');
    }

    return [
      ...base,
      'Free mode: be natural but brief. Give 1-3 useful sentences and one simple next step when appropriate.',
      'If asked about Free, explain that the base version can track accounts, expenses, income, goals, limits, obligations, simple analytics and short conversations.',
      'Do not expose plan names, tool names, internal rules or premium mechanics. Do not aggressively sell Premium.',
    ].join(' ');
  }


  private buildFallbackAnswer(command: string, style: AIAnswerStyle, intent: unknown) {
    if (intent === 'identity_help') return this.buildIdentityFallback(command, style);
    return buildFinanceReplyFallback();
  }

  private buildIdentityFallback(command: string, style: AIAnswerStyle) {
    const isEnglish = /\b(who|what|how|premium|business|free|trial)\b/i.test(command) && !/[а-яё]/i.test(command);

    if (isEnglish) {
      if (style === 'business_accountant') {
        return 'I am Fina. In Business mode I work more like a hired bookkeeping assistant: I help track cashflow, expenses, obligations, receipts, documents and reports. The base version covers everyday personal money tracking; Premium adds deeper dialogue, forecasts and extended reports. Business is focused on control and operating discipline for business money.';
      }
      if (style === 'premium_companion') {
        return 'I am Fina, your finance assistant. In the base version I help track accounts, expenses, income, goals, limits and simple questions. Premium gives longer conversations, deeper analysis, forecasts, receipts and extended reports. Business is for a bookkeeping-style workflow with cashflow, documents and business control.';
      }
      return 'I am Fina, your finance assistant. You can write or speak naturally: add expenses, income, accounts, goals, limits, payments, or ask simple questions about your money. Premium adds deeper dialogue, forecasts, receipts and reports. Business works more like a bookkeeping assistant for business money.';
    }

    if (style === 'business_accountant') {
      return 'Я Фина. В Business-режиме я работаю скорее как нанятый помощник по учёту: помогаю следить за денежным потоком, расходами, обязательствами, чеками, документами и отчётами. Базовая версия подходит для личных денег, Premium добавляет более глубокий диалог и прогнозы, а Business делает упор на порядок в бизнес-деньгах.';
    }

    if (style === 'premium_companion') {
      return 'Я Фина, ваш финансовый помощник. В базовой версии я помогаю вести счета, расходы, доходы, цели, лимиты и отвечаю на простые вопросы по деньгам. В Premium можно общаться свободнее и глубже: разбирать привычки, зарплату, долги, прогнозы, чеки и отчёты. Business — отдельный режим для учёта бизнеса и контроля денег как с помощником-бухгалтером.';
    }

    return 'Я Фина, финансовый помощник. Можно писать или говорить обычными фразами: добавить расход, доход, счёт, цель, лимит, платёж или спросить про деньги. В Premium диалог глубже, есть прогнозы, чеки и расширенные отчёты. Business больше похож на помощника-бухгалтера для бизнес-денег.';
  }

  private predictLimit(style: AIAnswerStyle, modelRole: AIModelRole) {
    if (style === 'business_accountant') return modelRole === 'premium' ? 650 : 360;
    if (style === 'premium_companion') return 700;
    return 320;
  }

  private defaultStyle(tier: unknown, context: unknown): AIAnswerStyle {
    const tierText = String(tier || this.asRecord(this.asRecord(context).user).tier || 'FREE').toUpperCase();
    if (tierText === 'BUSINESS') return 'business_accountant';
    if (tierText === 'PREMIUM') return 'premium_companion';
    return 'free_companion';
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      tier: value.user?.tier ?? 'FREE',
      accounts: Array.isArray(value.accounts)
        ? value.accounts.slice(0, 8).map((account) => ({ name: account.name, currency: account.currency, balance: account.balance }))
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories.slice(0, 12).map((category) => ({ name: category.name, type: category.type }))
        : [],
      sections: Array.isArray(value.sections)
        ? value.sections.slice(0, 8).map((section) => section.name).filter(Boolean)
        : [],
      goals: Array.isArray(value.goals)
        ? value.goals.slice(0, 6).map((goal) => ({ title: goal.title, targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, currency: goal.currency, status: goal.status }))
        : [],
      obligations: Array.isArray(value.obligations)
        ? value.obligations.slice(0, 6).map((item) => ({ title: item.title, type: item.type, monthlyPayment: item.monthlyPayment, currentDebt: item.currentDebt, currency: item.currency, status: item.status, nextPaymentDate: item.nextPaymentDate }))
        : [],
      recentTransactions: Array.isArray(value.recentTransactions)
        ? value.recentTransactions.slice(0, 8).map((transaction) => ({
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          account: transaction.account?.name,
          category: transaction.category?.name,
          section: transaction.section?.name,
          createdAt: transaction.createdAt,
        }))
        : [],
      preferences: Array.isArray(value.memory?.preferences) ? value.memory.preferences.slice(0, 6) : [],
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
