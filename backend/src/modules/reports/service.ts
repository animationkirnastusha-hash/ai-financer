import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma';

export type ReportFormat = 'xlsx' | 'pdf';
export type ReportMode = 'base' | 'premium';
export type ReportTransactionType = 'all' | 'income' | 'expense' | 'transfer';

export type ReportFilters = {
  userId: string;
  mode: ReportMode;
  startDate?: Date;
  endDate?: Date;
  accountId?: string;
  categoryId?: string;
  type?: ReportTransactionType;
};

type MoneyBucket = {
  income: number;
  expense: number;
  transfer: number;
  count: number;
};

type ReportData = {
  user: {
    id: string;
    name: string;
    username?: string | null;
    tier: string;
  };
  mode: ReportMode;
  filters: ReportFilters;
  generatedAt: Date;
  transactions: any[];
  accounts: any[];
  categories: any[];
  sections: any[];
  loans: any[];
  goals: any[];
  summary: {
    income: number;
    expense: number;
    transfer: number;
    balance: number;
    count: number;
    averageExpense: number;
    averageIncome: number;
  };
  byCategory: Array<{ name: string; section: string; income: number; expense: number; count: number }>;
  byAccount: Array<{ name: string; currency: string; balance: number; income: number; expense: number; transfer: number; count: number }>;
};

function normalizeMode(value: unknown): ReportMode {
  return value === 'premium' ? value : 'base';
}

function normalizeFormat(value: unknown): ReportFormat {
  return value === 'pdf' ? 'pdf' : 'xlsx';
}

function normalizeType(value: unknown): ReportTransactionType {
  return value === 'income' || value === 'expense' || value === 'transfer' ? value : 'all';
}

function parseDate(value: unknown): Date | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU');
}

function formatMoney(value: number, currency = 'RUB') {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₽';
  return `${Math.round(value).toLocaleString('ru-RU')} ${symbol}`;
}

function getTypeLabel(type: string) {
  if (type === 'income') return 'Доход';
  if (type === 'expense') return 'Расход';
  if (type === 'transfer') return 'Перевод';
  return type || '—';
}

function getSafeString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '—';
}

function findReadableFont() {
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function addWorksheetTitle(sheet: ExcelJS.Worksheet, title: string, subtitle?: string) {
  sheet.addRow([title]);
  sheet.getRow(1).font = { bold: true, size: 16 };
  if (subtitle) {
    sheet.addRow([subtitle]);
    sheet.getRow(2).font = { color: { argb: 'FF667085' } };
  }
  sheet.addRow([]);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
  row.alignment = { vertical: 'middle' };
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    let max = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const text = String(cell.value ?? '');
      max = Math.max(max, Math.min(42, text.length + 4));
    });
    column.width = max;
  });
}

export class ReportService {
  parseFilters(userId: string, query: Record<string, unknown>): { filters: ReportFilters; format: ReportFormat } {
    return {
      format: normalizeFormat(query.format),
      filters: {
        userId,
        mode: normalizeMode(query.mode),
        startDate: parseDate(query.startDate),
        endDate: parseDate(query.endDate),
        accountId: typeof query.accountId === 'string' && query.accountId ? query.accountId : undefined,
        categoryId: typeof query.categoryId === 'string' && query.categoryId ? query.categoryId : undefined,
        type: normalizeType(query.type),
      },
    };
  }

  async buildReportData(filters: ReportFilters): Promise<ReportData> {
    const where: any = { userId: filters.userId };

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.type && filters.type !== 'all') where.type = filters.type;
    if (filters.accountId) {
      where.OR = [{ accountId: filters.accountId }, { toAccountId: filters.accountId }];
    }

    const [user, transactions, accounts, categories, sections, loans, goals] = await Promise.all([
      prisma.user.findUnique({ where: { id: filters.userId } }),
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, currency: true, balance: true } },
          toAccount: { select: { id: true, name: true, currency: true, balance: true } },
          category: { select: { id: true, name: true, type: true, sectionId: true, section: { select: { id: true, name: true } } } },
          section: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.account.findMany({ where: { userId: filters.userId }, orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ where: { userId: filters.userId }, include: { section: true }, orderBy: { name: 'asc' } }),
      prisma.section.findMany({ where: { userId: filters.userId }, orderBy: { name: 'asc' } }),
      prisma.loan.findMany({ where: { userId: filters.userId }, orderBy: { nextPaymentDate: 'asc' } }),
      prisma.goal.findMany({ where: { userId: filters.userId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const summary = transactions.reduce(
      (acc, transaction) => {
        const amount = Number(transaction.amount || 0);
        acc.count += 1;
        if (transaction.type === 'income') acc.income += amount;
        if (transaction.type === 'expense') acc.expense += amount;
        if (transaction.type === 'transfer') acc.transfer += amount;
        return acc;
      },
      { income: 0, expense: 0, transfer: 0, count: 0 },
    );

    const incomeCount = transactions.filter((item) => item.type === 'income').length;
    const expenseCount = transactions.filter((item) => item.type === 'expense').length;

    const categoryMap = new Map<string, { name: string; section: string; income: number; expense: number; count: number }>();
    for (const transaction of transactions) {
      const name = transaction.category?.name || (transaction.type === 'transfer' ? 'Переводы' : 'Без категории');
      const section = transaction.section?.name || transaction.category?.section?.name || 'Без раздела';
      const key = `${section}:${name}`;
      const item = categoryMap.get(key) ?? { name, section, income: 0, expense: 0, count: 0 };
      if (transaction.type === 'income') item.income += Number(transaction.amount || 0);
      if (transaction.type === 'expense') item.expense += Number(transaction.amount || 0);
      item.count += 1;
      categoryMap.set(key, item);
    }

    const accountMap = new Map<string, { name: string; currency: string; balance: number; income: number; expense: number; transfer: number; count: number }>();
    for (const account of accounts) {
      accountMap.set(account.id, {
        name: account.name,
        currency: account.currency,
        balance: Number(account.balance || 0),
        income: 0,
        expense: 0,
        transfer: 0,
        count: 0,
      });
    }

    for (const transaction of transactions) {
      const item = accountMap.get(transaction.accountId);
      if (!item) continue;
      if (transaction.type === 'income') item.income += Number(transaction.amount || 0);
      if (transaction.type === 'expense') item.expense += Number(transaction.amount || 0);
      if (transaction.type === 'transfer') item.transfer += Number(transaction.amount || 0);
      item.count += 1;
    }

    return {
      user: {
        id: filters.userId,
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Пользователь',
        username: user?.username,
        tier: user?.tier || 'FREE',
      },
      mode: filters.mode,
      filters,
      generatedAt: new Date(),
      transactions,
      accounts,
      categories,
      sections,
      loans,
      goals,
      summary: {
        ...summary,
        balance: summary.income - summary.expense,
        averageExpense: expenseCount ? Math.round(summary.expense / expenseCount) : 0,
        averageIncome: incomeCount ? Math.round(summary.income / incomeCount) : 0,
      },
      byCategory: Array.from(categoryMap.values()).sort((a, b) => b.expense - a.expense),
      byAccount: Array.from(accountMap.values()).sort((a, b) => b.count - a.count),
    };
  }

  async generateExcel(data: ReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Фина';
    workbook.created = data.generatedAt;

    const overview = workbook.addWorksheet('Обзор');
    addWorksheetTitle(overview, this.getReportTitle(data.mode), `Создан: ${data.generatedAt.toLocaleString('ru-RU')}`);
    overview.addRows([
      ['Пользователь', data.user.name],
      ['Период', this.getPeriodLabel(data.filters)],
      ['Операций', data.summary.count],
      ['Доходы', data.summary.income],
      ['Расходы', data.summary.expense],
      ['Итог', data.summary.balance],
      ['Средний доход', data.summary.averageIncome],
      ['Средний расход', data.summary.averageExpense],
    ]);
    overview.getColumn(2).numFmt = '#,##0 ₽';
    autoWidth(overview);

    const operations = workbook.addWorksheet('Операции');
    operations.columns = [
      { header: 'Дата', key: 'date', width: 14 },
      { header: 'Тип', key: 'type', width: 12 },
      { header: 'Сумма', key: 'amount', width: 16 },
      { header: 'Валюта', key: 'currency', width: 10 },
      { header: 'Счёт', key: 'account', width: 22 },
      { header: 'Куда', key: 'toAccount', width: 22 },
      { header: 'Раздел', key: 'section', width: 20 },
      { header: 'Категория', key: 'category', width: 20 },
      { header: 'Название', key: 'title', width: 28 },
      { header: 'Описание', key: 'description', width: 38 },
    ];
    styleHeader(operations.getRow(1));

    for (const transaction of data.transactions) {
      operations.addRow({
        date: formatDate(transaction.date),
        type: getTypeLabel(transaction.type),
        amount: transaction.type === 'expense' ? -Number(transaction.amount || 0) : Number(transaction.amount || 0),
        currency: transaction.account?.currency || 'RUB',
        account: transaction.account?.name || '—',
        toAccount: transaction.toAccount?.name || '—',
        section: transaction.section?.name || transaction.category?.section?.name || '—',
        category: transaction.category?.name || '—',
        title: transaction.title || '—',
        description: transaction.description || '—',
      });
    }
    operations.getColumn('amount').numFmt = '#,##0 ₽';
    autoWidth(operations);

    const categories = workbook.addWorksheet('Категории');
    categories.columns = [
      { header: 'Раздел', key: 'section' },
      { header: 'Категория', key: 'name' },
      { header: 'Доходы', key: 'income' },
      { header: 'Расходы', key: 'expense' },
      { header: 'Операций', key: 'count' },
    ];
    styleHeader(categories.getRow(1));
    data.byCategory.forEach((item) => categories.addRow(item));
    categories.getColumn('income').numFmt = '#,##0 ₽';
    categories.getColumn('expense').numFmt = '#,##0 ₽';
    autoWidth(categories);

    const accounts = workbook.addWorksheet('Счета');
    accounts.columns = [
      { header: 'Счёт', key: 'name' },
      { header: 'Валюта', key: 'currency' },
      { header: 'Баланс', key: 'balance' },
      { header: 'Доходы', key: 'income' },
      { header: 'Расходы', key: 'expense' },
      { header: 'Переводы', key: 'transfer' },
      { header: 'Операций', key: 'count' },
    ];
    styleHeader(accounts.getRow(1));
    data.byAccount.forEach((item) => accounts.addRow(item));
    ['balance', 'income', 'expense', 'transfer'].forEach((key) => { accounts.getColumn(key).numFmt = '#,##0 ₽'; });
    autoWidth(accounts);

    if (data.mode !== 'base') {
      const obligations = workbook.addWorksheet('Обязательства');
      obligations.columns = [
        { header: 'Название', key: 'title' },
        { header: 'Тип', key: 'type' },
        { header: 'Остаток', key: 'currentDebt' },
        { header: 'Платёж', key: 'monthlyPayment' },
        { header: 'Ставка', key: 'interestRate' },
        { header: 'Следующий платёж', key: 'nextPaymentDate' },
        { header: 'Статус', key: 'status' },
      ];
      styleHeader(obligations.getRow(1));
      data.loans.forEach((loan) => obligations.addRow({
        title: loan.title,
        type: loan.type,
        currentDebt: Number(loan.currentDebt || 0),
        monthlyPayment: Number(loan.monthlyPayment || 0),
        interestRate: loan.interestRate ?? '—',
        nextPaymentDate: formatDate(loan.nextPaymentDate),
        status: loan.status,
      }));
      obligations.getColumn('currentDebt').numFmt = '#,##0 ₽';
      obligations.getColumn('monthlyPayment').numFmt = '#,##0 ₽';
      autoWidth(obligations);

      const goals = workbook.addWorksheet('Цели');
      goals.columns = [
        { header: 'Цель', key: 'title' },
        { header: 'Нужно', key: 'targetAmount' },
        { header: 'Накоплено', key: 'currentAmount' },
        { header: 'Валюта', key: 'currency' },
        { header: 'Статус', key: 'status' },
      ];
      styleHeader(goals.getRow(1));
      data.goals.forEach((goal) => goals.addRow(goal));
      goals.getColumn('targetAmount').numFmt = '#,##0 ₽';
      goals.getColumn('currentAmount').numFmt = '#,##0 ₽';
      autoWidth(goals);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generatePdf(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 42 });
        const buffers: Buffer[] = [];
        const fontPath = findReadableFont();
        if (fontPath) doc.font(fontPath);

        doc.on('data', (chunk) => buffers.push(Buffer.from(chunk)));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        this.drawPdfHeader(doc, data);
        this.drawPdfSummary(doc, data);
        this.drawPdfCategorySummary(doc, data);
        this.drawPdfOperations(doc, data);

        if (data.mode !== 'base') this.drawPdfPremiumBlocks(doc, data);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  getReportTitle(mode: ReportMode) {
    if (mode === 'premium') return 'Расширенный финансовый отчёт';
    return 'Отчёт по операциям';
  }

  getFilename(mode: ReportMode, format: ReportFormat) {
    const date = new Date().toISOString().slice(0, 10);
    const prefix = mode === 'premium' ? 'fina-premium-report' : 'fina-operations-report';
    return `${prefix}-${date}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
  }

  getContentType(format: ReportFormat) {
    return format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  private getPeriodLabel(filters: ReportFilters) {
    if (!filters.startDate && !filters.endDate) return 'Все доступные операции';
    return `${formatDate(filters.startDate)} — ${formatDate(filters.endDate)}`;
  }

  private drawPdfHeader(doc: any, data: ReportData) {
    doc.fontSize(20).text(this.getReportTitle(data.mode), { align: 'left' });
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor('#667085').text(`Пользователь: ${data.user.name}`);
    doc.text(`Период: ${this.getPeriodLabel(data.filters)}`);
    doc.text(`Создан: ${data.generatedAt.toLocaleString('ru-RU')}`);
    doc.fillColor('#111827');
    doc.moveDown();
  }

  private drawPdfSummary(doc: any, data: ReportData) {
    doc.fontSize(13).text('Итоги', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10);
    doc.text(`Доходы: ${formatMoney(data.summary.income)}`);
    doc.text(`Расходы: ${formatMoney(data.summary.expense)}`);
    doc.text(`Итог: ${formatMoney(data.summary.balance)}`);
    doc.text(`Операций: ${data.summary.count}`);
    doc.moveDown();
  }

  private drawPdfCategorySummary(doc: any, data: ReportData) {
    doc.fontSize(13).text('Главные категории', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(9);
    const items = data.byCategory.slice(0, 8);
    if (!items.length) {
      doc.text('Категории появятся после операций.');
    } else {
      items.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.section} / ${item.name}: расходы ${formatMoney(item.expense)}, доходы ${formatMoney(item.income)}`);
      });
    }
    doc.moveDown();
  }

  private drawPdfOperations(doc: any, data: ReportData) {
    doc.fontSize(13).text('Операции', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(8);

    const rows = data.transactions.slice(0, data.mode === 'base' ? 60 : 120);
    if (!rows.length) {
      doc.text('За выбранный период операций нет.');
      doc.moveDown();
      return;
    }

    rows.forEach((transaction) => {
      if (doc.y > 760) doc.addPage();
      const category = transaction.category?.name || '—';
      const account = transaction.type === 'transfer'
        ? `${transaction.account?.name || '—'} → ${transaction.toAccount?.name || '—'}`
        : transaction.account?.name || '—';
      const sign = transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : '↔';
      doc.text(`${formatDate(transaction.date)} · ${getTypeLabel(transaction.type)} · ${sign}${formatMoney(Number(transaction.amount || 0), transaction.account?.currency || 'RUB')} · ${account} · ${category}`);
    });
    doc.moveDown();
  }

  private drawPdfPremiumBlocks(doc: any, data: ReportData) {
    if (doc.y > 690) doc.addPage();
    doc.fontSize(13).text('Расширенная часть', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(9);
    doc.text(`Обязательств: ${data.loans.length}`);
    doc.text(`Целей: ${data.goals.length}`);
    doc.text(`Средний расход: ${formatMoney(data.summary.averageExpense)}`);
    doc.text('Комментарий Фины: отчёт помогает увидеть структуру денег за период и подготовить следующий финансовый шаг.');
    doc.moveDown();
  }

}

export const reportService = new ReportService();
export const reportUtils = { normalizeMode, normalizeFormat, normalizeType };
