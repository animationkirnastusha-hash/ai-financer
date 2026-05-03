import { AIHandleOptions } from './types';
import { AITrustService } from './trust.service';
import { AIUndoService } from './undo.service';

const aiTrustService = new AITrustService();
const aiUndoService = new AIUndoService();

export class AIService {
  async handleCommand(userId: string, command: string, options?: AIHandleOptions) {
    return aiTrustService.handleCommand(userId, command, options);
  }

  async confirmCommand(userId: string, pendingActionId: string) {
    return aiTrustService.confirmCommand(userId, pendingActionId);
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