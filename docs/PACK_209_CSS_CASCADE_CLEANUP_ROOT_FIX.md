# PACK 209 — CSS cascade cleanup root fix

Цель: убрать конфликтующие CSS-слои, из-за которых аналитика визуально не менялась, категории резались через многоточие, а страницы целей/лимитов и платежей получали дублированные правила.

## Что изменено

- `frontend/src/app/styles/index.css`
  - аналитика импортируется одним блоком и только один раз;
  - удалены импорты устаревших override-файлов.

- `frontend/src/app/styles/pages/analytics/*`
  - `analytics-shell.css` теперь отвечает за поток страницы, табы, период и календарь;
  - `analytics-layout.css` отвечает за карточки и модалку разбора категорий;
  - `analytics-charts.css` отвечает только за графики и диаграммы;
  - `analytics-lists.css` отвечает только за список категорий;
  - названия категорий больше не должны резаться через `...`;
  - на мобильном диаграмма и список категорий идут в читаемой вертикальной структуре, чтобы названия и суммы помещались нормально.

- `frontend/src/app/styles/pages/goals-limits/*`
  - убран отдельный `polish`-слой из импортов;
  - правила KPI, карточек, списка и адаптива перенесены в базовые файлы;
  - KPI остаются в ряд на мобильном;
  - активный список целей/лимитов остаётся выше подсказочного блока.

- `frontend/src/app/styles/pages/payments/*`
  - убран отдельный `polish`-слой из импортов;
  - правила KPI, карточек, списка и адаптива перенесены в базовые файлы;
  - KPI остаются в ряд на мобильном;
  - активные платежи остаются выше подсказочного/вторичного блока.

## Что удалить вручную

Эти файлы больше не импортируются и специально должны быть удалены, иначе CSS-аудит будет считать их orphan/temporary files:

```text
frontend/src/app/styles/pages/analytics/analytics-clarity-spacing.css
frontend/src/app/styles/pages/analytics/analytics-profile-density.css
frontend/src/app/styles/pages/goals-limits/goals-limits/goals-limits-polish.css
frontend/src/app/styles/pages/payments/payments/payments-polish.css
```

## Проверено в архиве

- `npm run audit:css` после удаления перечисленных файлов: `Problems: 0`.
- `npm run audit:predeploy:strict`: CSS structure findings `0`.
- Полный `npm run build` в песочнице не выполняется из-за отсутствующих `node_modules` (`react`, `@types/node` и т.д.).
