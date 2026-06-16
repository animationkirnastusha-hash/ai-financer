import { createAIProvider } from './providers/ai-provider.factory';
import { AIUserTier } from './ai-model-router';

export type AIDialogIntent =
  | 'identity_help'
  | 'financial_action'
  | 'financial_question'
  | 'financial_coaching'
  | 'business_accounting'
  | 'app_navigation'
  | 'small_talk'
  | 'unclear';

export type AIAnswerStyle = 'free_companion' | 'premium_companion' | 'business_accountant';

export interface AIDialogRoute {
  intent: AIDialogIntent;
  shouldUseTools: boolean;
  answerStyle: AIAnswerStyle;
  confidence: number;
  summary?: string;
}

type RouteResponse = {
  intent?: string;
  shouldUseTools?: boolean;
  answerStyle?: string;
  confidence?: number;
  summary?: string;
};

type RouteContext = {
  user?: { tier?: string } | null;
  accounts?: unknown[];
  goals?: unknown[];
  obligations?: unknown[];
  recentTransactions?: unknown[];
};

const IDENTITY_HELP_PATTERNS = [
  'кто ты',
  'что ты умеешь',
  'что ты можешь',
  'что умеешь',
  'что можешь',
  'как с тобой',
  'как тобой',
  'как работать',
  'как пользоваться',
  'расскажи о себе',
  'расскажи про себя',
  'расскажи что умеешь',
  'зачем ты',
  'чем отличаешься',
  'что такое фина',
  'who are you',
  'what can you do',
  'how do i use',
  'how to use',
  'what is fina',
];

const PLAN_WORDS = [
  'премиум',
  'premium',
  'business',
  'бизнес',
  'триал',
  'trial',
  'базовая версия',
  'free версия',
  'free',
  'тариф',
  'тарифы',
];

const HELP_WORDS = [
  'что такое',
  'что дает',
  'что даёт',
  'что доступно',
  'чем отличается',
  'чем отличаются',
  'какая разница',
  'расскажи',
  'объясни',
  'как работает',
  'в чем разница',
  'версии',
  'версиях',
  'what is',
  'what does',
  'difference',
  'explain',
  'tell me',
  'versions',
];

export class AIDialogRouterService {
  private readonly provider = createAIProvider();

  async route(command: string, context: unknown, tier: AIUserTier): Promise<AIDialogRoute> {
    const localRoute = this.tryLocalRoute(command, tier);
    if (localRoute) return localRoute;

    try {
      const raw = await this.provider.generateJson<RouteResponse>({
        system: this.systemPrompt(),
        prompt: this.buildPrompt(command, context, tier),
        modelRole: 'fast',
        temperature: 0,
        timeoutMs: 8_000,
        numPredict: 240,
      });

      return this.normalizeRoute(raw, tier);
    } catch (error) {
      console.warn('[AI] dialog router failed, falling back to tool-safe mode', {
        message: error instanceof Error ? error.message : String(error),
      });
      return this.defaultActionRoute(tier);
    }
  }

  private systemPrompt() {
    return [
      'Return ONLY strict JSON. No markdown. No prose.',
      'Classify the user message before financial planning.',
      'Do not extract amounts, accounts, categories or other financial fields. This is not a command parser.',
      'Choose whether the message should go to tools or to a natural answer.',
      'Use tools only when the user wants to change app data, open/show app data, or ask a data-backed finance question.',
      'Use a natural answer when the user wants advice, emotional support, salary/budget discussion, casual conversation, or asks what Fina is and how to use the app.',
      'identity_help means the user asks who Fina is, what Fina can do, how to work with Fina, or how Free/Premium/Business differ. identity_help always has shouldUseTools=false.',
      'Never choose tools for general life complaints unless the user explicitly asks to create, update, delete, record, transfer, pay, show or calculate app data.',
      'For BUSINESS tier, business finance and bookkeeping conversations should use business_accountant style unless they are explicit app mutations.',
      'JSON shape: {"intent":"identity_help|financial_action|financial_question|financial_coaching|business_accounting|app_navigation|small_talk|unclear","shouldUseTools":true,"answerStyle":"free_companion|premium_companion|business_accountant","confidence":0.0,"summary":"short intent summary"}.',
    ].join(' ');
  }

  private buildPrompt(command: string, context: unknown, tier: AIUserTier) {
    return [
      'TIER:', String(tier || 'FREE').toUpperCase(),
      'CONTEXT_HINTS:', JSON.stringify(this.compactContext(context)),
      'ROUTING_RULES:',
      '- identity_help: user asks who Fina is, what Fina can do, how to use Fina, or what Free/Premium/Business/trial mean. shouldUseTools=false.',
      '- financial_action: user wants to create/update/delete/record/pay/transfer/set something in the app. shouldUseTools=true.',
      '- financial_question: user asks about their spending, income, balance, accounts, goals, obligations or reports. shouldUseTools=true.',
      '- app_navigation: user asks to open/show an app screen or list. shouldUseTools=true.',
      '- financial_coaching: user wants advice, planning, discussion or support. shouldUseTools=false.',
      '- business_accounting: business-tier user wants bookkeeping/cashflow/document/accounting discussion, not a direct mutation. shouldUseTools=false.',
      '- small_talk: casual or emotional message without a direct app action. shouldUseTools=false.',
      '- unclear: not enough meaning to act safely. shouldUseTools=false.',
      'USER:', command,
    ].join('\n');
  }

  private tryLocalRoute(command: string, tier: AIUserTier): AIDialogRoute | null {
    const normalized = command
      .toLocaleLowerCase('ru-RU')
      .replaceAll('ё', 'е')
      .replace(/[!?.,:;()\[\]{}"'`«»]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return null;

    const asksAboutFina = IDENTITY_HELP_PATTERNS.some((pattern) => normalized.includes(pattern));
    const asksAboutPlan = PLAN_WORDS.some((plan) => normalized.includes(plan))
      && HELP_WORDS.some((word) => normalized.includes(word));

    if (asksAboutFina || asksAboutPlan) {
      const tierText = String(tier || 'FREE').toUpperCase();
      return {
        intent: 'identity_help',
        shouldUseTools: false,
        answerStyle: tierText === 'BUSINESS' ? 'business_accountant' : tierText === 'PREMIUM' ? 'premium_companion' : 'free_companion',
        confidence: 0.96,
        summary: 'The user asks who Fina is, what she can do, how to use her, or how Free, Premium and Business differ.',
      };
    }

    return null;
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as RouteContext;
    return {
      tier: value.user?.tier,
      accountsCount: Array.isArray(value.accounts) ? value.accounts.length : 0,
      goalsCount: Array.isArray(value.goals) ? value.goals.length : 0,
      obligationsCount: Array.isArray(value.obligations) ? value.obligations.length : 0,
      recentTransactionsCount: Array.isArray(value.recentTransactions) ? value.recentTransactions.length : 0,
    };
  }

  private normalizeRoute(raw: RouteResponse, tier: AIUserTier): AIDialogRoute {
    const tierText = String(tier || 'FREE').toUpperCase();
    const intent = this.normalizeIntent(raw.intent);
    const answerStyle = this.normalizeAnswerStyle(raw.answerStyle, tierText, intent);
    const confidence = this.clampConfidence(raw.confidence);
    const shouldUseTools = intent === 'identity_help'
      ? false
      : typeof raw.shouldUseTools === 'boolean'
        ? raw.shouldUseTools
        : this.defaultShouldUseTools(intent);

    return {
      intent,
      shouldUseTools,
      answerStyle,
      confidence,
      summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim().slice(0, 240) : undefined,
    };
  }

  private normalizeIntent(value: unknown): AIDialogIntent {
    if (
      value === 'identity_help' ||
      value === 'financial_action' ||
      value === 'financial_question' ||
      value === 'financial_coaching' ||
      value === 'business_accounting' ||
      value === 'app_navigation' ||
      value === 'small_talk' ||
      value === 'unclear'
    ) {
      return value;
    }
    return 'financial_action';
  }

  private normalizeAnswerStyle(value: unknown, tier: string, intent: AIDialogIntent): AIAnswerStyle {
    if (value === 'business_accountant' || tier === 'BUSINESS' || intent === 'business_accounting') return 'business_accountant';
    if (value === 'premium_companion' || tier === 'PREMIUM') return 'premium_companion';
    return 'free_companion';
  }

  private defaultShouldUseTools(intent: AIDialogIntent) {
    return intent === 'financial_action' || intent === 'financial_question' || intent === 'app_navigation';
  }

  private defaultActionRoute(tier: AIUserTier): AIDialogRoute {
    const tierText = String(tier || 'FREE').toUpperCase();
    return {
      intent: 'financial_action',
      shouldUseTools: true,
      answerStyle: tierText === 'BUSINESS' ? 'business_accountant' : tierText === 'PREMIUM' ? 'premium_companion' : 'free_companion',
      confidence: 0.5,
    };
  }

  private clampConfidence(value: unknown) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0.5;
    return Math.min(1, Math.max(0, number));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }
}
