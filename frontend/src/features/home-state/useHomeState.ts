export type HomeState =
  | 'NEW_USER'
  | 'EARLY_USER'
  | 'ACTIVE_USER';

type HomeStateInput = {
  accountsCount: number;
  transactionsCount: number;
};

export function getHomeState(data: HomeStateInput): HomeState {
  if (data.accountsCount === 0 || data.transactionsCount === 0) {
    return 'NEW_USER';
  }

  if (data.transactionsCount < 15) {
    return 'EARLY_USER';
  }

  return 'ACTIVE_USER';
}