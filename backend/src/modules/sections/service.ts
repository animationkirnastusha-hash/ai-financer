import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { progressionActivityBridge } from '../progression/activity-bridge.service';

export interface CreateSectionInput {
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateSectionInput {
  name?: string;
  icon?: string | null;
  color?: string | null;
}

export class SectionService {
  async getUserSections(userId: string) {
    return prisma.section.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            categories: true,
            transactions: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async createSection(userId: string, input: CreateSectionInput) {
    const name = this.normalizeName(input.name);

    const existing = await this.findSectionByName(userId, name);
    if (existing) return existing;

    const section = await prisma.section.create({
      data: {
        userId,
        name,
        icon: input.icon ?? '🗂️',
        color: input.color ?? '#7C5CFF',
      },
    });

    await progressionActivityBridge.trackSectionCreated(userId, section);

    return section;
  }

  async updateSection(userId: string, sectionId: string, input: UpdateSectionInput) {
    const existing = await prisma.section.findFirst({
      where: { id: sectionId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Section not found');
    }

    const nextName = input.name !== undefined ? this.normalizeName(input.name) : undefined;

    return prisma.section.update({
      where: { id: existing.id },
      data: {
        ...(nextName ? { name: nextName } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
  }

  async deleteSection(userId: string, sectionId: string) {
    const existing = await prisma.section.findFirst({
      where: { id: sectionId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Section not found');
    }

    await prisma.$transaction([
      prisma.category.updateMany({
        where: { userId, sectionId: existing.id },
        data: { sectionId: null },
      }),
      prisma.transaction.updateMany({
        where: { userId, sectionId: existing.id },
        data: { sectionId: null },
      }),
      prisma.section.delete({ where: { id: existing.id } }),
    ]);

    return existing;
  }

  async findOrCreateSection(userId: string, rawName: string) {
    const name = this.normalizeName(rawName);
    const existing = await this.findSectionByName(userId, name);

    if (existing) return existing;

    return this.createSection(userId, { name });
  }

  async assignMatchingExpensesToSection(
    userId: string,
    params: { rawQuery: string; sectionName: string },
  ) {
    const query = this.normalizeName(params.rawQuery).toLowerCase();
    const section = await this.findOrCreateSection(userId, params.sectionName);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
      },
      include: {
        category: true,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const matched = transactions.filter((transaction) => {
      const categoryName = transaction.category?.name?.toLowerCase() ?? '';
      const description = transaction.description?.toLowerCase() ?? '';
      return categoryName.includes(query) || query.includes(categoryName) || description.includes(query);
    });

    if (matched.length === 0) {
      return { section, updatedCount: 0 };
    }

    const ids = matched.map((item) => item.id);
    const categoryIds = Array.from(
      new Set(matched.map((item) => item.categoryId).filter((id): id is string => Boolean(id))),
    );

    const [transactionResult] = await prisma.$transaction([
      prisma.transaction.updateMany({
        where: { userId, id: { in: ids } },
        data: { sectionId: section.id },
      }),
      prisma.category.updateMany({
        where: { userId, id: { in: categoryIds } },
        data: { sectionId: section.id },
      }),
    ]);

    return { section, updatedCount: transactionResult.count };
  }

  private async findSectionByName(userId: string, rawName: string) {
    const name = this.normalizeName(rawName).toLowerCase();
    const sections = await prisma.section.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    return sections.find((section) => {
      const current = section.name.toLowerCase();
      return current === name || current.includes(name) || name.includes(current);
    });
  }

  private normalizeName(value: string) {
    const name = value?.trim().replace(/[«»"]/g, '').replace(/\s+/g, ' ');

    if (!name) {
      throw new BadRequestError('Section name is required');
    }

    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
