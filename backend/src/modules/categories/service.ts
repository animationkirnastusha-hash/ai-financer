import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';

export type CategoryType = 'income' | 'expense';

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  icon?: string | null;
  color?: string | null;
}

export class CategoryService {
  async getUserCategories(userId: string) {
    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });

    return categories;
  }

  async createCategory(userId: string, input: CreateCategoryInput) {
    const name = input.name?.trim();

    if (!name) {
      throw new BadRequestError('Category name is required');
    }

    if (input.type !== 'income' && input.type !== 'expense') {
      throw new BadRequestError('Invalid category type');
    }

    const category = await prisma.category.create({
      data: {
        userId,
        name,
        type: input.type,
        icon: input.icon ?? '💰',
        color: input.color ?? '#5B8DEF',
      },
    });

    return category;
  }

  async updateCategory(userId: string, categoryId: string, input: UpdateCategoryInput) {
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: input.name?.trim(),
        icon: input.icon,
        color: input.color,
      },
    });

    return updated;
  }

  async deleteCategory(userId: string, categoryId: string) {
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    const usage = await prisma.transaction.count({
      where: {
        userId,
        categoryId,
      },
    });

    if (usage > 0) {
      throw new BadRequestError('Cannot delete category used in transactions');
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    return existing;
  }
}