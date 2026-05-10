import { BadRequestError } from '../../shared/core/errors';

export class AIUndoService {
  async undoByAuditLog(_userId: string, _auditLogId: string) {
    throw new BadRequestError('Undo is not implemented in AI Core v1 yet');
  }
}
