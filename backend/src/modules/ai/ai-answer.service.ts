import { createAIProvider } from "./providers/ai-provider.factory";
import { AIModelRole } from "./providers/ai-provider.types";
import {
  buildFinanceReplyFallback,
  cleanAssistantReply,
} from "./messages/ai-reply-fallbacks";
import { AIAnswerStyle, AIDialogIntent } from "./ai-dialog-router.service";

type UserContext = {
  user?: { tier?: string } | null;
  accounts?: Array<{
    name?: string;
    type?: string;
    currency?: string;
    balance?: number;
  }>;
  categories?: Array<{ name?: string; type?: string }>;
  sections?: Array<{ name?: string }>;
  goals?: Array<{
    title?: string;
    targetAmount?: number;
    currentAmount?: number;
    currency?: string;
    status?: string;
  }>;
  obligations?: Array<{
    title?: string;
    type?: string;
    monthlyPayment?: number;
    currentDebt?: number;
    currency?: string;
    status?: string;
    nextPaymentDate?: unknown;
  }>;
  recentTransactions?: Array<{
    type?: string;
    amount?: number;
    description?: string;
    createdAt?: unknown;
    account?: { name?: string };
    category?: { name?: string } | null;
    section?: { name?: string } | null;
  }>;
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
    const answerLanguage = this.resolveAnswerLanguageFromScript(command);
    const system = this.buildSystemPrompt(
      style,
      modelRole,
      options.intent,
      answerLanguage,
    );

    const prompt = [
      "Context:",
      JSON.stringify(this.compactContext(context)),
      "User:",
      command,
    ].join("\n");

    const raw = await this.provider.generateJson<AnswerResponse>({
      system,
      prompt:
        preplannedAnswer && preplannedAnswer.trim().length > 8
          ? `${prompt}\nIntent or answer hint from routing layer:\n${preplannedAnswer.trim()}`
          : prompt,
      modelRole,
      temperature: style === "free_companion" ? 0.25 : 0.45,
      timeoutMs: modelRole === "premium" ? 45_000 : 12_000,
      numPredict: this.predictLimit(style, modelRole),
    });

    const answer = cleanAssistantReply(raw.answer);
    return answer || buildFinanceReplyFallback();
  }

  private buildSystemPrompt(
    style: AIAnswerStyle,
    modelRole: AIModelRole,
    intent: unknown,
    answerLanguage: "en" | "ru" | null,
  ) {
    const base = [
      'You are Fina inside a finance app. Return JSON only: {"answer":"..."}.',
      this.languageRule(answerLanguage),
      "No markdown. No chain-of-thought. Do not claim actions were saved unless a tool result explicitly did it.",
      "A message is not always a command. If it is a question, discussion, complaint or casual message, answer naturally instead of forcing an app action.",
      "Stay mostly around money, habits, income, spending, goals, obligations and planning, but you may respond like a normal helpful assistant when the user is emotional or casual.",
      "If app data is empty, say that directly and suggest the smallest useful next step. Do not pretend there are expenses, accounts or reports.",
      "Do not give legal, tax, investment or medical guarantees. You may help structure thoughts and suggest what to check.",
      `Intent hint: ${typeof intent === "string" ? intent : "unknown"}.`,
      typeof intent === "string" && intent === "identity_help"
        ? "Identity/help mode: briefly explain that you are Fina, that the user can write or speak by pressing the microphone, and that you can help with accounts, expenses, income, goals, limits, payments and questions. If the user is new or asks to get acquainted, do not list Free/Premium unless asked; suggest creating the first account with a name and current balance. If the user asks about Free or Premium, explain simply: Free covers basic money tracking and short help; Premium will return later after the base version is rebuilt."
        : "",
    ].filter(Boolean);

    if (style === "premium_companion") {
      return [
        ...base,
        "Premium mode: you may be more conversational, warm and adaptive. You can discuss salary stress, debt pressure, habits, goals and plans over several turns.",
        "Use available finance context to personalize the answer. If context is thin, say what data would help and propose one next step.",
        "Give a useful mini-plan when the user asks for advice, but do not turn advice into saved app actions without explicit permission.",
        "Answer in 3-7 short sentences unless the user asks for detail.",
      ].join(" ");
    }

    return [
      ...base,
      "Free mode: be natural but brief. Give 1-3 useful sentences and one simple next step when appropriate.",
      "Do not expose plan names, tool names, internal rules or premium mechanics. Do not aggressively sell Premium.",
    ].join(" ");
  }

  private languageRule(answerLanguage: "en" | "ru" | null) {
    if (answerLanguage === "en") {
      return "The current user message is in English. Answer strictly in English. Do not use Russian words, Russian explanations, or Russian UI phrases unless the user explicitly asks for Russian.";
    }

    if (answerLanguage === "ru") {
      return "The current user message is in Russian. Answer in Russian unless the user explicitly asks for another language.";
    }

    return "Speak in the same language as the current user message. If the message is mixed, prefer the language used for the main question.";
  }

  private resolveAnswerLanguageFromScript(command: string): "en" | "ru" | null {
    const text = command.trim();
    if (!text) return null;

    const cyrillicCount = (text.match(/[А-Яа-яЁё]/g) || []).length;
    const latinCount = (text.match(/[A-Za-z]/g) || []).length;

    if (latinCount >= 2 && latinCount >= cyrillicCount * 2) return "en";
    if (cyrillicCount >= 2 && cyrillicCount >= latinCount) return "ru";

    return null;
  }

  private predictLimit(style: AIAnswerStyle, modelRole: AIModelRole) {
    if (style === "premium_companion") return 700;
    return 320;
  }

  private defaultStyle(tier: unknown, context: unknown): AIAnswerStyle {
    const tierText = String(
      tier || this.asRecord(this.asRecord(context).user).tier || "FREE",
    ).toUpperCase();
    if (tierText === "PREMIUM") return "premium_companion";
    return "free_companion";
  }

  private compactContext(context: unknown) {
    const value = this.asRecord(context) as UserContext;
    return {
      tier: value.user?.tier ?? "FREE",
      accounts: Array.isArray(value.accounts)
        ? value.accounts
            .slice(0, 8)
            .map((account) => ({
              name: account.name,
              currency: account.currency,
              balance: account.balance,
            }))
        : [],
      categories: Array.isArray(value.categories)
        ? value.categories
            .slice(0, 12)
            .map((category) => ({ name: category.name, type: category.type }))
        : [],
      sections: Array.isArray(value.sections)
        ? value.sections
            .slice(0, 8)
            .map((section) => section.name)
            .filter(Boolean)
        : [],
      goals: Array.isArray(value.goals)
        ? value.goals
            .slice(0, 6)
            .map((goal) => ({
              title: goal.title,
              targetAmount: goal.targetAmount,
              currentAmount: goal.currentAmount,
              currency: goal.currency,
              status: goal.status,
            }))
        : [],
      obligations: Array.isArray(value.obligations)
        ? value.obligations
            .slice(0, 6)
            .map((item) => ({
              title: item.title,
              type: item.type,
              monthlyPayment: item.monthlyPayment,
              currentDebt: item.currentDebt,
              currency: item.currency,
              status: item.status,
              nextPaymentDate: item.nextPaymentDate,
            }))
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
      preferences: Array.isArray(value.memory?.preferences)
        ? value.memory.preferences.slice(0, 6)
        : [],
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
