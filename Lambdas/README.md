| Rule ID | Rule Description             | Trigger Timing / Frequency                  | Lambda or Trigger Source      | ✅ Test Status     |
| ------: | ---------------------------- | ------------------------------------------- | ----------------------------- | ----------------- |
|    `R1` | **Onboarding Completion**    | 15 minutes after user signup                | `onboardingReminderLambda`    | ⬜ Not Tested      |
|    `R2` | **Add My SoloMate Reminder** | 24h after signup, if no SoloMate added      | `soloMateAddReminderLambda`   | ⬜ Not Tested      |
|    `R3` | **First Call Reminder**      | 9 AM next day after signup, if no call made | `firstCallReminderLambda`     | ⬜ Not Tested      |
|    `R4` | **Emotional Check-In**       | Daily at 9 AM                               | `dailyCheckInLambda`          | ⬜ Not Tested      |
|    `R5` | **Interest-Based Nudges**    | Contextual / preference-based               | `interestNudgeLambda`         | ⬜ Not Tested      |
|    `R6` | **Time-Based Reconnects**    | 1, 3, 5 days of inactivity                  | `inactivityReminderLambda`    | ⬜ Not Tested      |
|    `R7` | **Talk Time Prompts**        | Real-time (e.g., when talk minutes low)     | Event-driven (non-Lambda)     | ⬜ Not Tested      |
|    `R8` | **Upgrade Promo**            | 9 AM if user promo flag is active           | `upgradePromoLambda`          | ⬜ Not Tested      |
|    `R9` | **Review Request**           | Day 5 and Day 10 post signup                | `reviewRequestLambda`         | ⬜ Not Tested      |
|   `R10` | **Feature Announce**         | Real-time when a new Persona is added       | SQS message sent from create Persona API | ✅ Tested (manual) |
