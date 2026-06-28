# PACK 206 — Analytics category breakdown

Цель: привести блок категорий в аналитике к компактному виду с диаграммой, суммами и процентами, а при большом числе категорий открывать отдельное окно поверх страницы.

Что изменено:

1. На странице аналитики блок структуры теперь показывает категории компактно: точка цвета, название, сумма, процент.
2. При большом числе категорий показывается кнопка «Ещё».
3. Кнопка «Ещё» открывает окно поверх аналитики с большой диаграммой и полным списком категорий.
4. Полный список не схлопывается в «Другое» — пользователь видит все категории.
5. Диаграмма в компактном блоке сохраняет общий итог через агрегированный сегмент «Другое».
6. Добавлены дополнительные отступы между блоками аналитики.
7. Новые тексты добавлены в RU/EN словари.

Файлы:

- frontend/src/pages/analytics/AnalyticsPage.tsx
- frontend/src/app/styles/pages/analytics/analytics-layout.css
- frontend/src/app/styles/pages/analytics/analytics-charts.css
- frontend/src/app/styles/pages/analytics/analytics-lists.css
- frontend/src/shared/lib/i18n/locales/ru/misc.ts
- frontend/src/shared/lib/i18n/locales/en/misc.ts
