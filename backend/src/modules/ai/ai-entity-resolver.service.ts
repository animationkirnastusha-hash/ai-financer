type AccountLike = {
  id: string;
  name: string;
  type?: string | null;
  currency?: string | null;
  balance?: number | null;
};

export type ResolvedEntity<T> = {
  item: T;
  score: number;
  reason: string;
};

const TYPE_ALIASES: Record<string, string[]> = {
  cash: ['cash', 'кэш', 'наличные', 'наличка', 'нал', 'деньги'],
  card: ['card', 'карта', 'картa', 'карточка', 'банк'],
  savings: ['savings', 'накопления', 'копилка', 'сбережения'],
  investment: ['investment', 'инвестиции', 'брокер', 'акции'],
};

export class AIEntityResolverService {
  resolveAccount<T extends AccountLike>(accounts: T[], raw: unknown): ResolvedEntity<T> | null {
    const query = this.normalize(raw);
    if (!query) return null;

    let best: ResolvedEntity<T> | null = null;

    for (const account of accounts) {
      const aliases = this.accountAliases(account);
      for (const alias of aliases) {
        const score = this.score(query, alias);
        if (!best || score > best.score) {
          best = { item: account, score, reason: alias };
        }
      }
    }

    return best && best.score >= 0.72 ? best : null;
  }

  buildAccountMemory<T extends AccountLike>(accounts: T[]) {
    return accounts.map((account) => ({
      name: account.name,
      type: account.type || 'cash',
      currency: account.currency || 'RUB',
      aliases: this.accountAliases(account)
        .filter((alias, index, list) => alias && list.indexOf(alias) === index)
        .slice(0, 6),
    }));
  }

  private accountAliases(account: AccountLike): string[] {
    const base = this.normalize(account.name);
    const words = base.split(' ').filter((word) => word.length >= 2);
    const type = this.normalize(account.type);
    const typeAliases = TYPE_ALIASES[type] ?? [];

    return [
      base,
      ...words,
      ...typeAliases.map((value) => this.normalize(value)),
    ].filter(Boolean);
  }

  private score(query: string, alias: string): number {
    if (!query || !alias) return 0;
    if (query === alias) return 1;
    if (query.includes(alias) || alias.includes(query)) {
      const ratio = Math.min(query.length, alias.length) / Math.max(query.length, alias.length);
      return Math.max(0.74, ratio);
    }

    const distance = this.levenshtein(query, alias);
    const max = Math.max(query.length, alias.length);
    if (max <= 0) return 0;

    return 1 - distance / max;
  }

  private normalize(value: unknown): string {
    if (typeof value !== 'string') return '';

    return value
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i += 1) matrix[i] = [i];
    for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i += 1) {
      for (let j = 1; j <= a.length; j += 1) {
        matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
          ? matrix[i - 1][j - 1]
          : Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
      }
    }

    return matrix[b.length][a.length];
  }
}
