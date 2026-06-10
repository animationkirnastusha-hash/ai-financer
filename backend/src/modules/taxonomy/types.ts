export type TaxonomyEntryType = 'income' | 'expense' | 'both';

export type TaxonomyIconRule = {
  id: string;
  type: TaxonomyEntryType;
  sectionId: string;
  sectionName: string;
  sectionIcon: string;
  sectionColor: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  keywords: string[];
};

export type ResolvedTaxonomy = {
  type: 'income' | 'expense';
  sectionName: string;
  sectionIcon: string;
  sectionColor: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  confidence: number;
  matchedRuleId: string;
};
