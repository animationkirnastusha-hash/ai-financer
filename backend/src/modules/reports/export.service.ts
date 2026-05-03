import { prisma } from '../../lib/prisma';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';


interface ExportOptions {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
}

export class ExportService {
  async getTransactionsForExport(options: ExportOptions) {
    const where: any = { userId: options.userId };
    
    if (options.startDate || options.endDate) {
      where.date = {};
      if (options.startDate) where.date.gte = options.startDate;
      if (options.endDate) where.date.lte = options.endDate;
    }
    
    if (options.categoryId) where.categoryId = options.categoryId;
    if (options.accountId) {
      where.OR = [
        { accountId: options.accountId },
        { toAccountId: options.accountId },
      ];
    }

    return prisma.transaction.findMany({
      where,
      include: {
        account: { select: { name: true, currency: true } },
        toAccount: { select: { name: true, currency: true } },
        category: { select: { name: true, icon: true, color: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async generatePDF(transactions: any[], userName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Заголовок
        doc.fontSize(24).font('Helvetica-Bold').text('AI-Finance', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Отчёт по транзакциям', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Пользователь: ${userName}`, { align: 'left' });
        doc.text(`Дата создания: ${new Date().toLocaleDateString('ru-RU')}`, { align: 'left' });
        doc.text(`Всего транзакций: ${transactions.length}`, { align: 'left' });
        doc.moveDown();

        // Итоги
        const totalIncome = transactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        
        doc.fontSize(12).font('Helvetica-Bold').text('Итоги:', { underline: true });
        doc.fontSize(11).font('Helvetica')
          .text(`Доходы: +${totalIncome.toLocaleString('ru-RU')} ₽`, { continued: false })
          .text(`Расходы: -${totalExpense.toLocaleString('ru-RU')} ₽`, { continued: false })
          .text(`Баланс: ${(totalIncome - totalExpense).toLocaleString('ru-RU')} ₽`);
        doc.moveDown();

        // Таблица
        const tableTop = doc.y + 20;
        const colWidths = [80, 80, 60, 80, 150];
        const headers = ['Дата', 'Тип', 'Сумма', 'Категория', 'Описание'];
        
        // Заголовки таблицы
        doc.fontSize(10).font('Helvetica-Bold');
        let x = 50;
        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });
        
        // Линия под заголовками
        doc.moveTo(50, tableTop + 20)
           .lineTo(550, tableTop + 20)
           .stroke();
        
        // Данные
        doc.font('Helvetica');
        let y = tableTop + 30;
        
        transactions.forEach((t) => {
          if (y > 750) {
            doc.addPage();
            y = 50;
          }
          
          const date = new Date(t.date).toLocaleDateString('ru-RU');
          const type = t.type === 'income' ? 'Доход' : t.type === 'expense' ? 'Расход' : 'Перевод';
          const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '↔';
          const amount = `${sign}${t.amount.toLocaleString('ru-RU')} ₽`;
          const category = t.category?.name || (t.type === 'transfer' ? 'Перевод' : '—');
          const description = t.description || (t.type === 'transfer' ? `${t.account?.name} → ${t.toAccount?.name}` : '');
          
          x = 50;
          doc.text(date, x, y, { width: colWidths[0] }); x += colWidths[0];
          doc.text(type, x, y, { width: colWidths[1] }); x += colWidths[1];
          doc.text(amount, x, y, { width: colWidths[2] }); x += colWidths[2];
          doc.text(category, x, y, { width: colWidths[3] }); x += colWidths[3];
          doc.text(description.substring(0, 30), x, y, { width: colWidths[4] });
          
          y += 20;
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateExcel(transactions: any[], userName: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Лист 1: Транзакции
    const sheet1 = workbook.addWorksheet('Транзакции');
    
    sheet1.columns = [
      { header: 'Дата', key: 'date', width: 15 },
      { header: 'Тип', key: 'type', width: 12 },
      { header: 'Сумма', key: 'amount', width: 15 },
      { header: 'Счёт', key: 'account', width: 20 },
      { header: 'Категория', key: 'category', width: 20 },
      { header: 'Описание', key: 'description', width: 30 },
    ];
    
    // Стили заголовков
    sheet1.getRow(1).font = { bold: true };
    sheet1.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF40A7E3' },
    };
    sheet1.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    
    transactions.forEach(t => {
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '↔';
      const amount = parseFloat(`${sign}${t.amount}`);
      
      const row = sheet1.addRow({
        date: new Date(t.date).toLocaleDateString('ru-RU'),
        type: t.type === 'income' ? 'Доход' : t.type === 'expense' ? 'Расход' : 'Перевод',
        amount: amount,
        account: t.type === 'transfer' ? `${t.account?.name} → ${t.toAccount?.name}` : t.account?.name,
        category: t.category?.name || '—',
        description: t.description || '',
      });
      
      // Цвет суммы
      const amountCell = row.getCell('amount');
      if (t.type === 'income') {
        amountCell.font = { color: { argb: 'FF2ECC71' } };
      } else if (t.type === 'expense') {
        amountCell.font = { color: { argb: 'FFE74C3C' } };
      } else {
        amountCell.font = { color: { argb: 'FF3498DB' } };
      }
      amountCell.numFmt = '#,##0.00 ₽';
    });

    // Лист 2: Итоги
    const sheet2 = workbook.addWorksheet('Итоги');
    
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    
    // По категориям
    const byCategory: Record<string, { income: number; expense: number }> = {};
    transactions.forEach(t => {
      const catName = t.category?.name || 'Без категории';
      if (!byCategory[catName]) {
        byCategory[catName] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') byCategory[catName].income += t.amount;
      if (t.type === 'expense') byCategory[catName].expense += t.amount;
    });
    
    sheet2.addRow(['Показатель', 'Сумма']).font = { bold: true };
    sheet2.addRow(['Общий доход', totalIncome]);
    sheet2.addRow(['Общий расход', totalExpense]);
    sheet2.addRow(['Баланс', totalIncome - totalExpense]);
    sheet2.addRow([]);
    sheet2.addRow(['Категория', 'Доходы', 'Расходы', 'Итого']).font = { bold: true };
    
    Object.entries(byCategory).forEach(([cat, amounts]) => {
      sheet2.addRow([cat, amounts.income, amounts.expense, amounts.income - amounts.expense]);
    });

    // Лист 3: Информация
    const sheet3 = workbook.addWorksheet('Информация');
    sheet3.addRow(['Отчёт AI-Finance']).font = { size: 16, bold: true };
    sheet3.addRow([]);
    sheet3.addRow(['Пользователь', userName]);
    sheet3.addRow(['Дата создания', new Date().toLocaleString('ru-RU')]);
    sheet3.addRow(['Всего транзакций', transactions.length]);
    sheet3.addRow(['Период', 'По выбранным фильтрам']);
    const buffer = await workbook.xlsx.writeBuffer();
   return Buffer.from(buffer);  // ← Конвертируем в Buffer
  }
}