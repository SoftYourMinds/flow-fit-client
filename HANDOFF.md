## Last Session Summary
**Date:** 2026-07-15
**Session focus:** JWT refresh bug fix and pull-to-refresh global handlers

### ✅ Accomplished
- Investigated and fixed a race condition during JWT refresh causing the user to log out on page reload when multiple requests failed with 401.
- Updated `auth.service.ts` to use `share()` on `refreshSubject` preventing parallel calls to the `/refresh` endpoint.
- Corrected error handling inside `checkAuthOnLoad` in `auth.service.ts` to avoid aggressive logout on general network errors.
- Added `ion-refresher` support for Clients, Locations, and Scheduler views to fetch data cleanly on pull-to-refresh without showing the global loader spinner.

### 🚀 Immediate Next Steps
1. Create dedicated metrics sub-page screen (`/tabs/clients/:id/add-metric`).
2. Add recurring workout generation system (`/sessions/recurring`).
