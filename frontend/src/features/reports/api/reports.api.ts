import { getAccessToken } from '@/features/auth/lib/accessToken';
import { env } from '@/shared/config/env';
import { apiClient } from '@/shared/api/client';

export type ReportMode = 'base' | 'premium' | 'business';
export type ReportFormat = 'xlsx' | 'pdf';
export type ReportType = 'all' | 'income' | 'expense' | 'transfer';

export type ReportExportParams = {
  mode: ReportMode;
  format: ReportFormat;
  startDate?: string;
  endDate?: string;
  accountId?: string;
  categoryId?: string;
  type?: ReportType;
};

export type ReportPreviewDto = {
  mode: ReportMode;
  generatedAt: string;
  summary: {
    income: number;
    expense: number;
    transfer: number;
    balance: number;
    count: number;
    averageExpense: number;
    averageIncome: number;
  };
  topCategories: Array<{ name: string; section: string; income: number; expense: number; count: number }>;
  accounts: Array<{ name: string; currency: string; balance: number; income: number; expense: number; transfer: number; count: number }>;
  transactionsCount: number;
  loansCount: number;
  goalsCount: number;
};

function buildQuery(params: ReportExportParams) {
  const search = new URLSearchParams();
  search.set('mode', params.mode);
  search.set('format', params.format);
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);
  if (params.accountId) search.set('accountId', params.accountId);
  if (params.categoryId) search.set('categoryId', params.categoryId);
  if (params.type && params.type !== 'all') search.set('type', params.type);
  return search.toString();
}

function getFilename(response: Response, fallback: string) {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

export const reportsApi = {
  async preview(params: ReportExportParams) {
    const query = buildQuery(params);
    return apiClient.get<ReportPreviewDto>(`/reports/preview?${query}`);
  },

  async download(params: ReportExportParams) {
    const token = getAccessToken();
    const query = buildQuery(params);
    const response = await fetch(`${env.apiBaseUrl}/reports/download?${query}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      let message = `Не удалось скачать отчёт (${response.status})`;
      try {
        const payload = await response.json();
        message = payload?.error?.message || payload?.message || message;
      } catch {
        // keep fallback message
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const filename = getFilename(response, params.format === 'pdf' ? 'fina-report.pdf' : 'fina-report.xlsx');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
