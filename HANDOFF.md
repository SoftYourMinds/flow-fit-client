# FlowFit Client Handoff

## Last Session Summary

**Date:** 2026-11-27
**Session focus:** v0.5.0 — Client Archive/Delete, 1-Click Session Editing, Recurring Group Sessions, Profile Scheduling & Location Default Prices

### ✅ Accomplished
- **Clients & Profile (`ClientsComponent`, `DetailsComponent`, `ClientsService`):**
  - Added swipe-left options (Archive / Restore / Soft-Delete) and Telegram-style Archive folder on Clients list.
  - Replaced top-right share icon in Client Profile with `...` ActionSheet (Share Link, Edit Profile, Archive/Restore, Delete Profile).
  - Added "+ Запланувати тренування" button on Client Profile Sessions tab and unified subscription creation with optional schedule setup.
  - Added 2-choice subscription deletion ("Лише абонемент" vs "З майбутніми заняттями") with local notification cleanup.
- **1-Click Session Editing (`SessionModalComponent`, `SchedulerComponent`, `SubscriptionDetailModalComponent`):**
  - Upgraded `SessionModalComponent` with `persistOnSubmit`, status selector, subscription deduct/unlink/create block, delete session button, and location-based price auto-fill.
  - Updated Scheduler Day/Week/Month views, Client Profile history, and Subscription Detail calendar/list to open `SessionModalComponent` directly in 1 tap.
  - Added "+ Додати" session on any date and subscription action menu (Add Series, Edit, Delete) in `SubscriptionDetailModalComponent`.
- **Recurring Group/One-Off Sessions & Quick Subscriptions (`CreateWizardModalComponent`):**
  - Added minimal "Повторювати тренування" section in Step 2B supporting `GROUP` and `INDIVIDUAL` sessions without a subscription.
  - Added quick "+ Оформити абонемент" and "Абонемент + графік" actions in Individual mode when a selected client has no active subscription.
  - Added "Одразу скласти розклад" toggle in Step 2A.
- **Location Default Prices (`LocationsService`, `LocationModalComponent`, `LocationsComponent`, `RecurringModalComponent`):**
  - Added `defaultGroupPrice` and `defaultIndividualPrice` fields to Locations and wired auto-fill across all session creation forms.
- **Release & Verification:**
  - Bumped Client version to `0.5.0` (`package.json`, `environment.ts`, `environment.prod.ts`) and verified `npm run build` with 0 errors.

### ⚠️ Pending / Known Issues
- None.

### 🚀 Immediate Next Steps
1. Verify all 4 new user flows on mobile PWA after Vercel deployment.
