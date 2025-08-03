Rule based Evaluation for Seidnging Notification

| Rule ID | Rule Description         | Frequency                         | Trigger Lambda              |
| ------- | ------------------------ | --------------------------------- | --------------------------- |
| `R1`    | Onboarding Completion    | 15 mins after signup              | `onboardingReminderLambda`  |
| `R2`    | Add My SoloMate Reminder | 24h after signup, if no SoloMate  | `soloMateAddReminderLambda` |
| `R3`    | First Call Reminder      | 9 AM day after signup, if no call | `firstCallReminderLambda`   |
| `R4`    | Emotional Check-In       | Daily @ 9 AM                      | `dailyCheckInLambda`        |
| `R5`    | Interest-Based Nudges    | Daily or contextual               | `interestNudgeLambda`       |
| `R6`    | Time-Based Reconnects    | 1, 3, 5 days inactivity           | `inactivityReminderLambda`  |
| `R7`    | Talk Time Prompts        | Realtime triggers                 | (event-based, not Lambda)   |
| `R8`    | Upgrade Promo            | 9 AM if promo flag true           | `upgradePromoLambda`        |
| `R9`    | Review Request           | Day 5, 10 post signup             | `reviewRequestLambda`       |
| `R10`   | Feature Announce         | Realtime when admin adds Persona  | (already handled)           |
