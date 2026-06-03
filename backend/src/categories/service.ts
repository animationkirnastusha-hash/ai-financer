import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { progressionActivityBridge } from '../progression/activity-bridge.service';
import { resolveCategoryIcon, resolveTaxonomyIcon } from '../taxonomy/taxonomy-icons';

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
    return prisma.category.findMany({
      where: { userId },
      include: { section: true },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async createCategory(userId: string, input: CreateCategoryInput) {
    const name = this.normalizeName(input.name);

    if (input.type !== 'income' && input.type !== 'expense') {
      throw new BadRequestError('Invalid category type');
    }

    const resolved = resolveTaxonomyIcon(name, input.type);
    const sectionId = input.sectionId ?? (await this.findOrCreateResolvedSection(userId, resolved)).id;

    const category = await prisma.category.create({
      data: {
        userId,
        name,
        type: input.type,
        icon: input.icon ?? resolved.categoryIcon,
        color: input.color ?? resolved.categoryColor,
        sectionId,
      },
      include: { section: true },
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

    const nextName = input.name !== undefined ? this.normalizeName(input.name) : existing.name;
    const iconSuggestion = resolveCategoryIcon(nextName, existing.type as CategoryType);

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(input.name !== undefined ? { name: nextName } : {}),
        icon: input.icon !== undefined ? input.icon : iconSuggestion.icon,
        color: input.color !== undefined ? input.color : iconSuggestion.color,
        ...(input.sectionId !== undefined ? { sectionId: input.sectionId } : {}),
      },
      include: { section: true },
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

  private async findOrCreateResolvedSection(userId: string, resolved: ReturnType<typeof resolveTaxonomyIcon>) {
    const existing = await prisma.section.findFirst({
      where: { userId, name: resolved.sectionName },
    });

    if (existing) return existing;

    return prisma.section.create({
      data: {
        userId,
        name: resolved.sectionName,
        icon: resolved.sectionIcon,
        color: resolved.sectionColor,
      },
    });
  }

  private normalizeName(value: string) {
    const name = value?.trim().replace(/[«»"]/g, '').replace(/\s+/g, ' ');

    if (!name) {
      throw new BadRequestError('Category name is required');
    }

    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
