export function shouldUseBaseModel(
  userMessage: string
): boolean {
  const text = userMessage.toLowerCase();

  const conversationalTriggers = [
    'почему',
    'объясни',
    'посоветуй',
    'как лучше',
    'проанализируй',
    'аналитика',
    'оптимизировать',
    'финансовый план'
  ];

  return conversationalTriggers.some(trigger =>
    text.includes(trigger)
  );
}
