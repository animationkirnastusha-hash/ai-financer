# PACK 190 — Goals and limits v2 AI flow

## Scope

This pack continues pack 189 and upgrades the new Goals and limits page without removing backend models or legacy source files.

## Changed

- Old `goals` and `spending-limits` routes now render the unified `GoalsLimitsPage`.
- The unified page no longer opens goal/limit forms from the user-facing flow.
- Creation and editing entry points open the Fina chat overlay with a structured command.
- Goals tab focuses on goal progress, saved amount, remaining amount, and dedicated goal accounts.
- Limits tab focuses on active limits, spent amount, remaining budget, and limit pressure.
- Added a Fina guidance card and clearer active lists.
- Updated CSS using the same card/spacing principle as analytics.
- Added RU/EN i18n keys for all new user-facing text and Fina commands.

## Notes

- Legacy pages remain in the repository for compatibility and rollback.
- Backend contracts were not changed in this pack.
- Full cleanup should happen after Payments v2 is finished.
