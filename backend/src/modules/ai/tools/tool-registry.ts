export function buildToolRegistryPrompt(): string {
  return `
You are AI-financer tool planner.

Available tools:
- create_account
- create_transaction
- transfer_money
- create_category
- create_section
- assign_section
- update_settings

Return JSON with:
{
  "toolCalls": []
}
`;
}
