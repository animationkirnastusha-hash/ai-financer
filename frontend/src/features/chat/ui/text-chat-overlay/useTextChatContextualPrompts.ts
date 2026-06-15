import { useMemo } from 'react';

import { chooseAccountName, formatAmount } from '@/features/chat/ui/text-chat-overlay/helpers';

type PromptAccount = { name?: string | null; type?: string | null };
type PromptTransaction = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  amount?: number | string | null;
};

export function useTextChatContextualPrompts(
  accounts: PromptAccount[],
  transactions: PromptTransaction[],
) {
  return useMemo(() => {
    const accountName = chooseAccountName(accounts);
    const latest = transactions[0];
    const latestAmount = formatAmount(latest?.amount);
    const latestTitle =
      latest?.title || latest?.description || 'последнюю операцию';

    const prompts = [
      'Потратил на кофе',
      accountName ? `Получил зарплату на ${accountName}` : 'Получил зарплату',
      'Поставь лимит на кафе',
      'Покажи лимиты',
      'Создай цель на отпуск',
    ];

    if (latest?.id && latestAmount)
      prompts.unshift(`измени ${latestTitle} на ${latestAmount}`);

    return Array.from(new Set(prompts)).slice(0, 3);
  }, [accounts, transactions]);
}
