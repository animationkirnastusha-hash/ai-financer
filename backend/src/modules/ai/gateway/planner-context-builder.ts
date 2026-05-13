import { COMPACT_TOOLS } from './compact-tools';

export function buildCompactPlannerPrompt(
  userMessage: string
): string {
  const tools = COMPACT_TOOLS
    .map(tool => `- ${tool.name}: ${tool.description}`)
    .join('\n');

  return `
Return ONLY JSON.

Allowed tools:
${tools}

Format:
{
  "actions": [
    {
      "tool": "tool_name",
      "params": {}
    }
  ]
}

User:
${userMessage}
`;
}
