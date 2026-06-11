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
      accountName ? `расход 300 кофе с ${accountName}` : 'расход 300 кофе',
      accountName ? `доход 5000 на ${accountName}` : 'доход 5000',
      accountName
        ? `поставь лимит на ${accountName} 20000 в месяц`
        : 'поставь общий лимит расходов 80000 в месяц',
      'покажи лимиты',
      'создай цель отпуск 120000',
    ];

    if (latest?.id && latestAmount)
      prompts.unshift(`измени ${latestTitle} на ${latestAmount}`);

    return Array.from(new Set(prompts)).slice(0, 3);
  }, [accounts, transactions]);
}
