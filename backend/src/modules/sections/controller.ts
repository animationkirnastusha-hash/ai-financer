import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { SectionService } from './service';

const sectionService = new SectionService();

function getStringParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestError(`${fieldName} must be a non-empty string`);
  }

  return value;
}

export const getSections = asyncHandler(async (req: Request, res: Response) => {
  const sections = await sectionService.getUserSections(req.userId!);
  res.json({ sections });
});

export const createSection = asyncHandler(async (req: Request, res: Response) => {
  const section = await sectionService.createSection(req.userId!, {
    name: req.body.name,
    icon: req.body.icon,
    color: req.body.color,
  });

  res.status(201).json({
    message: 'Section created successfully',
    section,
  });
});

export const updateSection = asyncHandler(async (req: Request, res: Response) => {
  const sectionId = getStringParam(req.params.id, 'Section id');
  const section = await sectionService.updateSection(req.userId!, sectionId, {
    name: req.body.name,
    icon: req.body.icon,
    color: req.body.color,
  });

  res.json({
    message: 'Section updated successfully',
    section,
  });
});

export const deleteSection = asyncHandler(async (req: Request, res: Response) => {
  const sectionId = getStringParam(req.params.id, 'Section id');
  const section = await sectionService.deleteSection(req.userId!, sectionId);

  res.json({
    message: 'Section deleted successfully',
    section,
  });
});
