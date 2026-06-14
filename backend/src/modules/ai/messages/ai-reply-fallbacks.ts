export function cleanAssistantReply(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function buildFinanceReplyFallback() {
  return 'Не смогла ответить достаточно точно. Напиши вопрос короче или уточни сумму, счёт и период.';
}
