# FlowFit Memory

## Current State
- UI/UX modernization fully implemented with Nude & Terracotta theme (#C88A72).
- Class-based `.dark` theme configured in `variables.scss` and `global.scss`.
- Scheduler supports Day, Week, and Month views, with horizontal week-strip navigation.
- Workout cards feature quick payment toggle ("Оплачено") with Toast confirmation.
- `environment.ts` configured for local development (`http://localhost:4000`).

## Recent Changes
- Fixed JWT refresh race condition on page reload that caused simultaneous token requests and logouts.
- Corrected checkAuthOnLoad error handling to prevent aggressive logouts on non-auth network errors.
- Added `ion-refresher` support for Clients, Scheduler, and Locations pages.
- Added ability to edit client notes (frontend and backend support).
- Configured class-based dark mode (`body.dark`) and updated variables palette.
- Added Day/Week/Month mode switcher in `scheduler.component.html`.
- Updated tabs.page.scss and variables.scss for the glassmorphism UI.
- Integrated ClientSheetModalComponent into the client base.
- Refactored scheduler.component.ts and scheduler.component.html to support the new UI requirements.

## Known Issues
- None. Build completes successfully.
