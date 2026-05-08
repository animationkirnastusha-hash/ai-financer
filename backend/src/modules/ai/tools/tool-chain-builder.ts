import type { AIToolCall, AIToolPlan } from './tool-types';

function isReference(value: unknown) {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return ['туда', 'сюда', 'на него', 'на неё', 'на этот счет', 'на этот счёт'].includes(normalized);
}

function accountNameFrom(call: AIToolCall) {
  const name = call.args?.name ?? call.args?.accountName;
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
}

export function buildToolChain(plan: AIToolPlan): AIToolPlan {
  let lastAccountName: string | undefined;

  const toolCalls = plan.toolCalls.map((call) => {
    const next: AIToolCall = {
      ...call,
      args: { ...(call.args || {}) },
    };

    if (next.tool === 'create_account') {
      lastAccountName = accountNameFrom(next) || lastAccountName;
    }

    if (next.tool === 'create_transaction') {
      if (!next.args.accountName && lastAccountName) {
        next.args.accountName = lastAccountName;
      }

      if (isReference(next.args.accountName) && lastAccountName) {
        next.args.accountName = lastAccountName;
      }
    }

    if (next.tool === 'transfer_money') {
      if (isReference(next.args.toAccountName) && lastAccountName) {
        next.args.toAccountName = lastAccountName;
      }
    }

    return next;
  });

  return { ...plan, toolCalls };
}
