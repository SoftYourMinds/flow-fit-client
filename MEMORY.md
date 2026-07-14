# FlowFit Memory

## Current State
- UI/UX modernization fully implemented with Nude & Terracotta theme (#C88A72).
- Class-based `.dark` theme configured in `variables.scss` and `global.scss`.
- Scheduler supports Day, Week, and Month views, with horizontal week-strip navigation.
- Workout cards feature quick payment toggle ("Оплачено") with Toast confirmation.
- `environment.ts` configured for local development (`http://localhost:4000`).

## Recent Changes
- Added ability to edit client notes (frontend and backend support).
- Configured class-based dark mode (`body.dark`) and updated variables palette.
- Added `ToastController` and `togglePayment` method in `scheduler.component.ts`.
- Added Day/Week/Month mode switcher in `scheduler.component.html`.
- Updated tabs.page.scss and variables.scss for the glassmorphism UI.
- Integrated ClientSheetModalComponent into the client base.
- Refactored scheduler.component.ts and scheduler.component.html to support the new UI requirements.
- Updated reports.component.ts and reports.component.html for real-time dashboards and payment capabilities.
- Updated `apiUrl` in `environment.ts` to `http://localhost:4000`.

## Known Issues
- None. Build completes successfully.
