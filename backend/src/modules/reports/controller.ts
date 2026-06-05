import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { reportService } from './service';

function ensureUserId(value: unknown) {
  if (typeof value !== 'string' || !value) throw new BadRequestError('User is required');
  return value;
}

export const getReportPreview = asyncHandler(async (req: Request, res: Response) => {
  const userId = ensureUserId(req.userId);
  const { filters } = reportService.parseFilters(userId, req.query as Record<string, unknown>);
  const data = await reportService.buildReportData(filters);

  res.json({
    mode: data.mode,
    generatedAt: data.generatedAt,
    period: {
      startDate: filters.startDate?.toISOString() ?? null,
      endDate: filters.endDate?.toISOString() ?? null,
    },
    summary: data.summary,
    topCategories: data.byCategory.slice(0, 8),
    accounts: data.byAccount,
    transactionsCount: data.transactions.length,
    loansCount: data.loans.length,
    goalsCount: data.goals.length,
  });
});

export const downloadReport = asyncHandler(async (req: Request, res: Response) => {
  const userId = ensureUserId(req.userId);
  const { filters, format } = reportService.parseFilters(userId, req.query as Record<string, unknown>);
  const data = await reportService.buildReportData(filters);
  const buffer = format === 'pdf'
    ? await reportService.generatePdf(data)
    : await reportService.generateExcel(data);

  const filename = reportService.getFilename(filters.mode, format);
  res.setHeader('Content-Type', reportService.getContentType(format));
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
});
