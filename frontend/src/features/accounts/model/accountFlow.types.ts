export type AccountType = 'card' | 'cash' | 'savings' | 'investment';

export type CreateAccountDraft = {
  name: string;
  type: AccountType;
  currency: 'RUB' | 'USD' | 'EUR';
  initialBalance: string;
};