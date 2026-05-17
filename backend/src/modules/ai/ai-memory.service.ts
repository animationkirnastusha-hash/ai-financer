import { prisma } from '../../lib/prisma';
import { AIEntityResolverService } from './ai-entity-resolver.service';

const resolver = new AIEntityResolverService();

export class AIMemoryService {
  async buildUserMemory(userId: string, context: {
    accounts?: Array<{ id: string; name: string; type?: string | null; currency?: string | null; balance?: number | null }>;
  }) {
    const [messages, auditLogs] = await Promise.all([
      prisma.aIMessage.findMany({
        where: { userId, role: 'memory' },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.aIAuditLog.findMany({
        where: { userId, executed: true, status: { in: ['executed', 'confirmed'] } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const accountAliases = resolver.buildAccountMemory(context.accounts ?? []);

    return {
      accountAliases,
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
