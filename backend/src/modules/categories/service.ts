import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../shared/core/errors';
import { progressionActivityBridge } from '../progression/activity-bridge.service';
import { resolveCategoryAppearance, shouldReplaceGenericIcon } from '../taxonomy/taxonomy-icons';
import { normalizeTransactionCategoryName } from '../taxonomy/transaction-taxonomy';

export type CategoryType = 'income' | 'expense' | 'both';

export interface CreateCategoryInput {
  name: string;
  type?: CategoryType | null;
  icon?: string | null;
  color?: string | null;
  sectionId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  type?: CategoryType | null;
  icon?: string | null;
  color?: string | null;
  sectionId?: string | null;
}

function normalizeCategoryType(value?: CategoryType | string | null): CategoryType {
  if (value === 'income' || value === 'expense' || value === 'both') return value;
  return 'expense';
}

function taxonomyKind(type: CategoryType): 'income' | 'expense' {
  return type === 'income' ? 'income' : 'expense';
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
    const type = normalizeCategoryType(input.type);
    const appearance = resolveCategoryAppearance(name, taxonomyKind(type));
    const sectionId = null;

    const existing = await prisma.category.findFirst({ where: { userId, name } });
    if (existing) {
      return prisma.category.update({
        where: { id: existing.id },
        data: {
          type,
          sectionId,
          icon: input.icon ?? (shouldReplaceGenericIcon(existing.icon) ? appearance.categoryIcon : existing.icon),
          color: input.color ?? existing.color ?? appearance.categoryColor,
        },
        include: { section: true },
      });
    }

    const category = await prisma.category.create({
      data: {
        userId,
        name,
        type,
        icon: input.icon ?? appearance.categoryIcon,
        color: input.color ?? appearance.categoryColor,
        sectionId,
      },
      include: { section: true },
    });

    await progressionActivityBridge.trackCategoryCreated(userId, category);
    return category;
  }

  async updateCategory(userId: string, categoryId: string, input: UpdateCategoryInput) {
    const existing = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!existing) throw new NotFoundError('Category not found');

    const nextName = input.name !== undefined ? this.normalizeName(input.name) : existing.name;
    const nextType = input.type !== undefined ? normalizeCategoryType(input.type) : normalizeCategoryType(existing.type);
    const appearance = resolveCategoryAppearance(nextName, taxonomyKind(nextType));
    const nextSectionId = null;

    return prisma.category.update({
      where: { id: categoryId },
      data: {
        name: input.name !== undefined ? nextName : existing.name,
        type: nextType,
        sectionId: nextSectionId,
        icon: input.icon !== undefined ? input.icon : shouldReplaceGenericIcon(existing.icon) ? appearance.categoryIcon : existing.icon,
        color: input.color !== undefined ? input.color : existing.color ?? appearance.categoryColor,
      },
      include: { section: true },
    });
  }

  async deleteCategory(userId: string, categoryId: string) {
    const existing = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!existing) throw new NotFoundError('Category not found');

    await prisma.$transaction([
      prisma.transaction.updateMany({ where: { userId, categoryId }, data: { categoryId: null } }),
      prisma.category.delete({ where: { id: categoryId } }),
    ]);

    return existing;
  }

  private normalizeName(value: string) {
    const name = value?.trim().replace(/[«»"]/g, '').replace(/\s+/g, ' ');
    if (!name) throw new BadRequestError('Category name is required');
    return normalizeTransactionCategoryName(name) || name.charAt(0).toUpperCase() + name.slice(1);
  }
}
