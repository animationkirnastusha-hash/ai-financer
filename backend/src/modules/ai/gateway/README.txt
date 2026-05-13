LATENCY REDUCTION PACK

GOALS:
- reduce planner latency
- isolate base model
- reduce prompt size
- prevent unnecessary base calls
- reduce token generation
- stabilize tool planning

INTEGRATION:

1. use shouldUseBaseModel()
2. use buildCompactPlannerPrompt()
3. use PLANNER_CONFIG for fast planner
4. do NOT call base model for simple actions
5. use compact tool definitions
6. use planner telemetry logs

EXPECTED RESULT:
simple transactions:
1-4 sec

complex reasoning:
8-20 sec
