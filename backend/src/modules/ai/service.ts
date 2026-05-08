import { AIHandleOptions } from './types';
import { AITrustService } from './trust.service';
import { AIUndoService } from './undo.service';

const aiTrustService = new AITrustService();
const aiUndoService = new AIUndoService();

export class AIService {
  async handleCommand(userId: string, command: string, options?: AIHandleOptions) {
    return aiTrustService.handleCommand(userId, command, options);
  }

  async confirmCommand(userId: string, pendingActionId: string, parsedOverride?: Record<string, unknown>) {
    return aiTrustService.confirmCommand(userId, pendingActionId, parsedOverride);
  }

  async updatePendingAction(
    userId: string,
    pendingActionId: string,
    parsed: Record<string, unknown>,
    command?: string,
  ) {
    return aiTrustService.updatePendingAction(userId, pendingActionId, parsed, command);
  }

  async cancelCommand(userId: string, pendingActionId: string) {
    return aiTrustService.cancelCommand(userId, pendingActionId);
  }

  async getPendingActions(userId: string, includeExpired = false) {
    return aiTrustService.getPendingActions(userId, includeExpired);
  }

  async getAuditLogs(userId: string, limit = 50) {
    return aiTrustService.getAuditLogs(userId, limit);
  }

  async undoByAuditLog(userId: string, auditLogId: string) {
    return aiUndoService.undoByAuditLog(userId, auditLogId);
  }
}