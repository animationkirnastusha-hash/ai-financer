import { prisma } from '../../lib/prisma';
import { AIEntityResolverService } from './semantic/semantic-entity-resolver.service';

const resolver = new AIEntityResolverService();

const FINANCIAL_MEMORY_TOOLS = new Set([
  'create_transaction',
  'transfer_money',
  'create_account',
  'update_account',
  'delete_account',
  'delete_accounts',
  'set_primary_account',
  'create_category',
  'update_category',
  'delete_category',
  'create_section',
  'update_section',
  'delete_section',
  'assign_category_to_section',
  'create_goal',
  'update_goal',
  'delete_goal',
  'create_obligation',
  'update_obligation',
  'delete_obligation',
  'mark_obligation_paid',
  'create_obligation_reminder',
  'update_ai_settings',
  'apply_ai_settings_preset',
]);

export class AIMemoryService {
  async buildUserMemory(userId: string, context: {
    accounts?: Array<{ id: string; name: string; type?: string | null; currency?: string | null; balance?: number | null }>;
    categories?: Array<{ id: string; name: string; type?: string | null; sectionId?: string | null }>;
    sections?: Array<{ id: string; name: string }>;
    goals?: Array<{ id: string; title: string; status?: string | null }>;
  }) {
    const [messages, auditLogs] = await Promise.all([
      prisma.aIMessage.findMany({
        where: { userId, role: 'memory' },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.aIAuditLog.findMany({
        where: { userId, executed: true, status: { in: ['executed', 'confirmed', 'executed_after_clarification'] } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const accountAliases = resolver.buildAccountMemory(context.accounts ?? []);
    const categoryAliases = resolver.buildEntityMemory(context.categories ?? [], { kind: 'category', getLabel: (item) => item.name });
    const sectionAliases = resolver.buildEntityMemory(context.sections ?? [], { kind: 'section', getLabel: (item) => item.name });
    const goalAliases = resolver.buildEntityMemory(context.goals ?? [], { kind: 'goal', getLabel: (item) => item.title });

    return {
      accountAliases,
      categoryAliases,
      sectionAliases,
      goalAliases,
      preferences: messages
        .map((message) => this.safeParse(message.meta) ?? { content: message.content })
        .filter(Boolean)
        .slice(0, 12),
      recentSuccessfulCommands: auditLogs
        .map((log) => ({
          command: log.command,
          intent: log.intent,
          status: log.status,
        }))
        .slice(0, 8),
    };
  }


  async rememberFinancialResult(userId: string, params: {
    command: string;
    intent?: string;
    tool?: string | null;
    tools?: string[];
    result?: unknown;
  }) {
    const tools = params.tools?.length ? params.tools : params.tool ? [params.tool] : [];
    const isFinancial = tools.some((tool) => FINANCIAL_MEMORY_TOOLS.has(tool));
    if (!isFinancial) return null;

    const content = params.command.trim();
    if (!content) return null;

    const message = await prisma.aIMessage.create({
      data: {
        userId,
        role: 'memory',
        content,
        meta: JSON.stringify({
          domain: 'finance',
          memoryEligible: true,
          intent: params.intent ?? 'batch',
          tools,
          savedAt: new Date().toISOString(),
        }),
      },
    });

    const old = await prisma.aIMessage.findMany({
      where: { userId, role: 'memory' },
      orderBy: { createdAt: 'desc' },
      skip: 40,
      select: { id: true },
    });

    if (old.length > 0) {
      await prisma.aIMessage.deleteMany({ where: { id: { in: old.map((item) => item.id) } } });
    }

    return message;
  }

  private safeParse(value: string | null) {
    if (!value) return null;

    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
}
