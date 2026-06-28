# Pack 207b — Analytics build and style fix

## Scope

Build fix after pack 207 and completion of the CSS files that were referenced by the pack.

## Changes

- Restored analytics helper functions used by the page: period label, percent formatting, change calculation and transaction summing.
- Kept the removal of the short overview block.
- Kept analytics category rows non-clickable.
- Kept the full category breakdown sheet opened by the More button.
- Added the missing analytics spacing CSS fragment.
- Added the missing limits polish CSS fragment and imported it through the limits CSS entrypoint.
- Added the missing payments polish CSS fragment and imported it through the payments CSS entrypoint.
- Removed the orphan reports.css import from the style manifest because this file is not present in the current archive.
- No backend changes.
