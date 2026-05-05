import { prisma } from '../../lib/prisma';

export class AIUndoService {
  async undoLast(userId: string) {
    const last = await prisma.transaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!last) return null;

    await prisma.transaction.delete({
      where: { id: last.id },
    });

    return last;
  }
}