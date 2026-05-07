import { Request, Response } from 'express';
import { CategoryService } from './service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';

const categoryService = new CategoryService();

function getStringParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(`${fieldName} must be a non-empty string`);
  }

  return value;
}

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await categoryService.getUserCategories(req.userId!);

  res.json({ categories });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.userId!, {
    name: req.body.name,
    type: req.body.type,
    icon: req.body.icon,
    color: req.body.color,
    sectionId: req.body.sectionId,
  });

  res.status(201).json({
    message: 'Category created successfully',
    category,
  });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = getStringParam(req.params.id, 'Category id');

  const category = await categoryService.updateCategory(req.userId!, categoryId, {
    name: req.body.name,
    icon: req.body.icon,
    color: req.body.color,
  });

  res.json({
    message: 'Category updated successfully',
    category,
  });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = getStringParam(req.params.id, 'Category id');

  const category = await categoryService.deleteCategory(req.userId!, categoryId);

  res.json({
    message: 'Category deleted successfully',
    category,
  });
});