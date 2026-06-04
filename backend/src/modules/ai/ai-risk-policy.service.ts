import { AIRiskLevel, AIToolName, AIValidatedPlan } from './types';

const HIGH_RISK_TOOLS = new Set<AIToolName>([
  'delete_account',
  'delete_accounts',
  'delete_category',
  'delete_section',
  'delete_goal',
  'delete_obligation',
  'transfer_money',
  'undo_last_action',
]);

const ALWAYS_CONFIRM_TOOLS = new Set<AIToolName>([
  ...HIGH_RISK_TOOLS,
  'update_ai_settings',
  'apply_ai_settings_preset',
  'mark_obligation_paid',
]);

export class AIRiskPolicyService {
  apply(plan: AIValidatedPlan): AIValidatedPlan {
    const actions = plan.actions.map((action) => {
      const highRisk = HIGH_RISK_TOOLS.has(action.tool);
      const mustConfirm = ALWAYS_CONFIRM_TOOLS.has(action.tool);
      return {
        ...action,
        riskLevel: highRisk ? 'high' as AIRiskLevel : action.riskLevel,
        requiresConfirmation: mustConfirm ? true : action.requiresConfirmation,
      };
    });

    const riskLevel = this.maxRisk(actions.map((action) => action.riskLevel));
    return {
      ...plan,
      actions,
      riskLevel,
      requiresConfirmation: actions.some((action) => action.requiresConfirmation),
    };
  }

  private maxRisk(levels: AIRiskLevel[]): AIRiskLevel {
    if (levels.includes('high')) return 'high';
    if (levels.includes('medium')) return 'medium';
    return 'low';
  }
}

export const aiRiskPolicyService = new AIRiskPolicyService();
