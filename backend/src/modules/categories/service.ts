import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { progressionActivityBridge } from '../progression/activity-bridge.service';
import { resolveCategoryAppearance, shouldReplaceGenericIcon } from '../taxonomy/taxonomy-icons';

export type CategoryType = 'income' | 'expense';

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
  sectionId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  icon?: string | null;
  color?: string | null;
  sectionId?: string | null;
}

export class CategoryService {
  async getUserCategories(userId: string) {
    const categories = await prisma.category.findMany({
      where: { userId },
      include: { section: true },
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

    const appearance = resolveCategoryAppearance(name, input.type);

    const category = await prisma.category.create({
      data: {
        userId,
        name,
        type: input.type,
        icon: input.icon ?? appearance.categoryIcon,
        color: input.color ?? appearance.categoryColor,
        sectionId: input.sectionId ?? null,
      },
    });

    await progressionActivityBridge.trackCategoryCreated(userId, category);

    return category;
  }

  async updateCategory(userId: string, categoryId: string, input: UpdateCategoryInput) {
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    const nextName = input.name?.trim();
    const appearance = resolveCategoryAppearance(nextName || existing.name, existing.type === 'income' ? 'income' : 'expense');

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(nextName ? { name: nextName } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : (shouldReplaceGenericIcon(existing.icon) ? { icon: appearance.categoryIcon } : {})),
        ...(input.color !== undefined ? { color: input.color } : (!existing.color ? { color: appearance.categoryColor } : {})),
        ...(input.sectionId !== undefined ? { sectionId: input.sectionId } : {}),
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