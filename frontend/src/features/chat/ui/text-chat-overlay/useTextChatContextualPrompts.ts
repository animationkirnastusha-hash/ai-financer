import { useMemo } from 'react';

import { chooseAccountName, formatAmount } from '@/features/chat/ui/text-chat-overlay/helpers';
import { useI18n } from '@/shared/lib/i18n';

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
  const { t } = useI18n();

  return useMemo(() => {
    const accountName = chooseAccountName(accounts);
    const latest = transactions[0];
    const latestAmount = formatAmount(latest?.amount);
    const latestTitle =
      latest?.title || latest?.description || t('textChat.prompt.latestOperation');

    const prompts = [
      t('textChat.prompt.expense'),
      accountName
        ? t('textChat.prompt.salaryAccount', { account: accountName })
        : t('textChat.prompt.salary'),
      t('textChat.prompt.limitCafe'),
      t('textChat.prompt.showLimits'),
      t('textChat.prompt.goal'),
    ];

    if (latest?.id && latestAmount)
      prompts.unshift(
        t('textChat.prompt.editLatest', {
          title: latestTitle,
          amount: latestAmount,
        }),
      );

    return Array.from(new Set(prompts)).slice(0, 3);
  }, [accounts, t, transactions]);
}
