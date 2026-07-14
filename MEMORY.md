# FlowFit Memory

## Current State
- UI/UX modernization fully implemented with Nude & Terracotta theme (#C88A72).
- Class-based `.dark` theme configured in `variables.scss` and `global.scss`.
- Scheduler supports Day, Week, and Month views, with horizontal week-strip navigation.
- Workout cards feature quick payment toggle ("Оплачено") with Toast confirmation.
- `environment.ts` configured for devtunnel remote endpoint (`https://2p7hpg02-4000.euw.devtunnels.ms`).

## Recent Changes
- Configured class-based dark mode (`body.dark`) and updated variables palette.
- Added `ToastController` and `togglePayment` method in `scheduler.component.ts`.
- Added Day/Week/Month mode switcher in `scheduler.component.html`.
- Updated `.agents/AGENTS.md` rules for theme customization & memory management state persistence.

## Known Issues
- None. Build completes successfully.
