import { buildEntityAliases } from './entity-aliases';
import { buildSemanticVariants, normalizeSemanticText, semanticStemText } from './semantic-normalizer';
import { semanticBestScore, semanticThreshold } from './semantic-scorer';
import { SemanticEntityKind, SemanticEntityLike, SemanticEntityMemoryItem, SemanticResolvedEntity } from './semantic-types';

type AccountLike = SemanticEntityLike & {
  id: string;
  name: string;
  type?: string | null;
  currency?: string | null;
  balance?: number | null;
};

type GoalLike = SemanticEntityLike & {
  id?: string | null;
  title: string;
  status?: string | null;
};

export type ResolvedEntity<T> = SemanticResolvedEntity<T>;

export class AIEntityResolverService {
  resolveAccount<T extends AccountLike>(accounts: T[], raw: unknown): ResolvedEntity<T> | null {
    const exact = this.resolveExactLabel(accounts, raw, (account) => account.name);
    if (exact) return exact;

    const primary = this.resolvePrimaryAccount(accounts, raw);
    if (primary) {
      return {
        item: primary,
        score: 0.99,
        reason: 'primary_account_alias',
        matchedText: normalizeSemanticText(raw),
        confidence: 'high',
      };
    }

    return this.resolveNamed(accounts, raw, {
      kind: 'account',
      getLabel: (account) => account.name,
      minScore: 0.68,
    });
  }

  resolveGoal<T extends GoalLike>(goals: T[], raw: unknown): ResolvedEntity<T> | null {
    return this.resolveNamed(goals, raw, {
      kind: 'goal',
      getLabel: (goal) => goal.title,
      minScore: 0.68,
    });
  }

  resolveNamed<T extends SemanticEntityLike>(items: T[], raw: unknown, params: {
    kind?: SemanticEntityKind;
    getLabel: (item: T) => string;
    minScore?: number;
  }): ResolvedEntity<T> | null {
    const query = normalizeSemanticText(raw);
    if (!query) return null;

    const exact = this.resolveExactLabel(items, raw, params.getLabel);
    if (exact) return exact;

    const queryVariants = buildSemanticVariants(query);
    let best: ResolvedEntity<T> | null = null;

    for (const item of items) {
      const label = params.getLabel(item);
      const aliases = buildEntityAliases({ ...item, name: item.name ?? label, title: item.title ?? label }, params.kind ?? 'generic');
      const match = semanticBestScore(queryVariants, aliases);
      if (!best || match.score > best.score) {
        best = {
          item,
          score: match.score,
          reason: match.alias || label,
          matchedText: match.query,
          confidence: this.confidence(match.score),
        };
      }
    }

    if (!best) return null;
    const threshold = params.minScore ?? semanticThreshold(query);
    return best.score >= threshold ? best : null;
  }

  buildAccountMemory<T extends AccountLike>(accounts: T[]): SemanticEntityMemoryItem[] {
    return accounts.map((account) => ({
      name: account.name,
      kind: 'account',
      type: account.type || 'cash',
      currency: account.currency || 'RUB',
      aliases: this.buildEntityMemoryAliases(account, 'account').slice(0, 8),
    }));
  }

  buildEntityMemory<T extends SemanticEntityLike>(items: T[], params: {
    kind: SemanticEntityKind;
    getLabel: (item: T) => string;
  }): SemanticEntityMemoryItem[] {
    return items.map((item) => {
      const name = params.getLabel(item);
      return {
        name,
        kind: params.kind,
        type: item.type ?? null,
        currency: item.currency ?? null,
        aliases: this.buildEntityMemoryAliases({ ...item, name }, params.kind).slice(0, 8),
      };
    });
  }

  normalizeText(value: unknown) {
    return normalizeSemanticText(value);
  }

  private resolveExactLabel<T>(items: T[], raw: unknown, getLabel: (item: T) => string): ResolvedEntity<T> | null {
    const query = normalizeSemanticText(raw);
    if (!query) return null;

    const queryStem = semanticStemText(query);

    for (const item of items) {
      const label = normalizeSemanticText(getLabel(item));
      if (!label) continue;
      const labelStem = semanticStemText(label);
      if (label === query || labelStem === queryStem) {
        return {
          item,
          score: 1,
          reason: 'exact_label',
          matchedText: query,
          confidence: 'high',
        };
      }
    }

    return null;
  }

  private buildEntityMemoryAliases(entity: SemanticEntityLike, kind: SemanticEntityKind) {
    return buildEntityAliases(entity, kind)
      .filter((alias, index, list) => alias && list.indexOf(alias) === index)
      .slice(0, 10);
  }

  private resolvePrimaryAccount<T extends AccountLike>(accounts: T[], raw: unknown): T | null {
    const query = normalizeSemanticText(raw);
    const primaryAliases = new Set([
      'основной', 'основная', 'основной счет', 'основной счёт', 'основная карта',
      'главный', 'главная', 'главный счет', 'главный счёт', 'главная карта',
      'main', 'default',
    ]);

    if (!primaryAliases.has(query)) return null;

    return accounts.find((account) => normalizeSemanticText(account.name).includes('основн'))
      ?? accounts.find((account) => normalizeSemanticText(account.type) === 'card')
      ?? accounts[0]
      ?? null;
  }

  private confidence(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.88) return 'high';
    if (score >= 0.74) return 'medium';
    return 'low';
  }
}
