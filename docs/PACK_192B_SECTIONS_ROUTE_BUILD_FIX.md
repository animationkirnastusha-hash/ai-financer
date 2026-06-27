# PACK 192B — Sections route build fix

Фиксит сборочную ошибку после pack-192.

## Причина

`SectionsPage` требует обязательный prop `onBack`, а маршрут `sections` в `AppRouter.tsx` был добавлен без него.

## Что изменено

- `AppRouter.tsx` теперь берёт `goBack` из `useNavigationStore`.
- `SectionsPage` открывается как `<SectionsPage onBack={goBack} />`.

## Проверка

```bash
cd /root/ai-financer/frontend
rm -rf dist
npm run build
npm run audit:css
npm run audit:predeploy:strict
```
