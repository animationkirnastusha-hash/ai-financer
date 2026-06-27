import { createAIProvider } from "./providers/ai-provider.factory";
import { AIUserTier } from "./ai-model-router";

export type AIDialogIntent =
  | "financial_action"
  | "financial_question"
  | "financial_coaching"
  | "app_navigation"
  | "small_talk"
  | "identity_help"
  | "unclear";

export type AIAnswerStyle =
  | "free_companion"
  | "premium_companion";

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

export class AIDialogRouterService {
  private readonly provider = createAIProvider();

  async route(
    command: string,
    context: unknown,
    tier: AIUserTier,
  ): Promise<AIDialogRoute> {
    try {
      const raw = await this.provider.generateJson<RouteResponse>({
        system: this.systemPrompt(),
        prompt: this.buildPrompt(command, context, tier),
        modelRole: "fast",
        temperature: 0,
        timeoutMs: 8_000,
        numPredict: 220,
      });

      return this.normalizeRoute(raw, tier);
    } catch (error) {
      console.warn(
        "[AI] dialog router failed, falling back to tool-safe mode",
        {
          message: error instanceof Error ? error.message : String(error),
        },
      );
      return this.defaultActionRoute(tier);
    }
  }

  private systemPrompt() {
    return [
      "Return ONLY strict JSON. No markdown. No prose.",
      "Classify the user message before financial planning.",
      "Do not extract amounts, accounts, categories or other financial fields in this routing step.",
      "Choose whether the message should go to tools or to a natural answer.",
      "Use tools when the user wants to change app data, open/show app data, ask a data-backed finance question, or record a completed financial fact. Spending limits, obligations, subscriptions, loans, reminders and account balances are app data.",
      "A completed or intended balance-changing statement belongs to financial_action, even when it is written as a short note rather than an imperative.",
      "Use a natural answer only when the user wants advice, emotional support, planning discussion, or casual conversation without any app mutation.",
      "Never choose tools for general life complaints unless the user explicitly asks to create, update, delete, record, transfer, pay, show or calculate app data.",
      'JSON shape: {"intent":"financial_action|financial_question|financial_coaching|app_navigation|small_talk|identity_help|unclear","shouldUseTools":true,"answerStyle":"free_companion|premium_companion","confidence":0.0,"summary":"short intent summary"}.',
    ].join(" ");
  }

  private buildPrompt(command: string, context: unknown, tier: AIUserTier) {
    return [
      "TIER:",
      String(tier || "FREE").toUpperCase(),
      "CONTEXT_HINTS:",
      JSON.stringify(this.compactContext(context)),
      "ROUTING_GUIDE:",
      "- financial_action: user wants to create/update/delete/record/pay/transfer/set something in the app, including finished money movement, spending limits, obligations, subscriptions, loan payments and reminders. shouldUseTools=true.",
      "- financial_question: user asks about their spending, income, balance, accounts, goals, obligations, limits, upcoming payments or reports. shouldUseTools=true.",
      "- app_navigation: user asks to open/show an app screen or list. shouldUseTools=true.",
      "- financial_coaching: user wants advice, planning, discussion or support. shouldUseTools=false.",
      "- small_talk: casual or emotional message without a direct app action. shouldUseTools=false.",
      "- identity_help: user asks who Fina is, what Fina can do, how to work with Fina, onboarding, Free/Premium capabilities, or says they are a new user. shouldUseTools=false.",
      "- unclear: not enough meaning to act safely. shouldUseTools=false.",
      "USER:",
      command,
    ].join("\n");
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as RouteContext;
    return {
      tier: value.user?.tier,
      accountsCount: Array.isArray(value.accounts) ? value.accounts.length : 0,
      goalsCount: Array.isArray(value.goals) ? value.goals.length : 0,
      obligationsCount: Array.isArray(value.obligations)
        ? value.obligations.length
        : 0,
      recentTransactionsCount: Array.isArray(value.recentTransactions)
        ? value.recentTransactions.length
        : 0,
    };
  }

  private normalizeRoute(raw: RouteResponse, tier: AIUserTier): AIDialogRoute {
    const tierText = String(tier || "FREE").toUpperCase();
    const intent = this.normalizeIntent(raw.intent);
    const answerStyle = this.normalizeAnswerStyle(
      raw.answerStyle,
      tierText,
      intent,
    );
    const confidence = this.clampConfidence(raw.confidence);
    const shouldUseTools =
      typeof raw.shouldUseTools === "boolean"
        ? raw.shouldUseTools
        : this.defaultShouldUseTools(intent);

    return {
      intent,
      shouldUseTools,
      answerStyle,
      confidence,
      summary:
        typeof raw.summary === "string" && raw.summary.trim()
          ? raw.summary.trim().slice(0, 240)
          : undefined,
    };
  }

  private normalizeIntent(value: unknown): AIDialogIntent {
    if (
      value === "financial_action" ||
      value === "financial_question" ||
      value === "financial_coaching" ||
      value === "app_navigation" ||
      value === "small_talk" ||
      value === "identity_help" ||
      value === "unclear"
    ) {
      return value;
    }
    return "financial_action";
  }

  private normalizeAnswerStyle(
    value: unknown,
    tier: string,
    intent: AIDialogIntent,
  ): AIAnswerStyle {
    if (value === "premium_companion" || tier === "PREMIUM")
      return "premium_companion";
    return "free_companion";
  }

  private defaultShouldUseTools(intent: AIDialogIntent) {
    return (
      intent === "financial_action" ||
      intent === "financial_question" ||
      intent === "app_navigation"
    );
  }

  private defaultActionRoute(tier: AIUserTier): AIDialogRoute {
    const tierText = String(tier || "FREE").toUpperCase();
    return {
      intent: "financial_action",
      shouldUseTools: true,
      answerStyle:
        tierText === "PREMIUM"
          ? "premium_companion"
          : "free_companion",
      confidence: 0.5,
    };
  }

  private clampConfidence(value: unknown) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0.5;
    return Math.min(1, Math.max(0, number));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
