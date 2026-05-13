export interface CompactToolDefinition {
  name: string;
  description: string;
}

export const COMPACT_TOOLS: CompactToolDefinition[] = [
  {
    name: 'create_expense',
    description: 'Create expense transaction'
  },
  {
    name: 'create_income',
    description: 'Create income transaction'
  },
  {
    name: 'transfer_between_accounts',
    description: 'Transfer money between accounts'
  },
  {
    name: 'create_account',
    description: 'Create financial account'
  },
  {
    name: 'get_stats',
    description: 'Get transaction statistics'
  }
];
