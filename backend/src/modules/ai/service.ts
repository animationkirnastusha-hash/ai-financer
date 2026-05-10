import { AIHandleOptions } from './types';
import { AIOrchestratorService } from './ai-orchestrator.service';
import { AIUndoService } from './undo.service';

const orchestrator = new AIOrchestratorService();
const undo = new AIUndoService();

export class AIService {
  async handleCommand(userId: string, command: string, options?: AIHandleOptions) {
    return orchestrator.handleCommand(userId, command, options);
  }

  async confirmCommand(userId: string, pendingActionId: string) {
    return orchestrator.confirmCommand(userId, pendingActionId);
  }

  async updatePendingAction(userId: string, pendingActionId: string, parsed: Record<string, unknown>, command?: string) {
    return orchestrator.updatePendingAction(userId, pendingActionId, parsed, command);
  }

  async cancelCommand(userId: string, pendingActionId: string) {
    return orchestrator.cancelCommand(userId, pendingActionId);
  }

  async getPendingActions(userId: string, includeExpired = false) {
    return orchestrator.getPendingActions(userId, includeExpired);
  }

  async getAuditLogs(userId: string, limit = 50) {
    return orchestrator.getAuditLogs(userId, limit);
  }

  async undoByAuditLog(userId: string, auditLogId: string) {
    return undo.undoByAuditLog(userId, auditLogId);
  }
}
