import type { TaxonomyIconRule } from '../types';
import { workExpenseRules } from './work-expense';
import { incomeRules } from './income';
import { extraRules } from './extra';

export const workIncomeExtraRules: TaxonomyIconRule[] = [
  ...workExpenseRules,
  ...incomeRules,
  ...extraRules,
];
