export type SemanticEntityKind =
  | 'account'
  | 'category'
  | 'section'
  | 'goal'
  | 'obligation'
  | 'spending_limit'
  | 'screen'
  | 'generic';

export type SemanticEntityLike = {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  type?: string | null;
  currency?: string | null;
  balance?: number | null;
  sectionId?: string | null;
};

export type SemanticResolvedEntity<T> = {
  item: T;
  score: number;
  reason: string;
  matchedText: string;
  confidence: 'high' | 'medium' | 'low';
};

export type SemanticEntityMemoryItem = {
  name: string;
  kind: SemanticEntityKind;
  aliases: string[];
  type?: string | null;
  currency?: string | null;
};
