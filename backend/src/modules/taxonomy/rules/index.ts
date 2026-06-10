import type { TaxonomyIconRule } from '../types';
import { foodRules } from './food';
import { mobilityHomeRules } from './mobility-home';
import { paymentsRecurringRules } from './payments-recurring';
import { lifestyleRules } from './lifestyle';
import { leisureTravelRules } from './leisure-travel';
import { workIncomeExtraRules } from './work-income-extra';

export const TAXONOMY_ICON_RULES: TaxonomyIconRule[] = [
  ...foodRules,
  ...mobilityHomeRules,
  ...paymentsRecurringRules,
  ...lifestyleRules,
  ...leisureTravelRules,
  ...workIncomeExtraRules,
];
