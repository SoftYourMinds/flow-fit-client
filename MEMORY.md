# FlowFit Memory

## Current State
- UI/UX modernization fully implemented with Nude & Terracotta theme (#C88A72).
- Class-based `.dark` theme configured in `variables.scss` and `global.scss`.
- Scheduler supports Day, Week, and Month views, with horizontal week-strip navigation.
- Workout cards are clickable and open a detailed `session-detail` page.
- Payment tracking (`isPaid`) has been completely removed in favor of a simpler `price` per session model.
- `environment.ts` configured for local development (`http://localhost:4000`).

## Recent Changes
- Fixed API bug in `SessionsController.findOne` where `trainerId` and `sessionId` were passed in the wrong order, causing 404 errors when attempting to view or edit sessions.
- Fixed Angular router parameter caching issue by migrating `route.snapshot` usage to `route.paramMap.subscribe()` in `SessionDetailComponent` and `DetailsComponent`, fixing a bug where clicking the second item in the same view wouldn't update the data.
- Implemented 4 Core Tabs + "Більше" (More) Glassmorphism Action Sheet Drawer (*Клієнти*, *Розклад*, *Звіти*, *Більше*).
- Added *Локації*, *Налаштування*, and Theme Toggle into the "Більше" drawer menu.
- Fixed bottom toolbar dark mode theme selector bug (`:host-context`) and safe-area inset height cutoff.
- Removed `isPaid` tracking from `SessionParticipant`.
- Renamed `pricePerPerson` to `price` in `WorkoutSession` (now represents the total price of the training).
- Replaced inline quick actions in Scheduler with a dedicated "Деталі тренування" (Session Detail) page.
- Sessions now display up to 3 participant avatars on the card.
- Fixed JWT refresh race condition on page reload that caused simultaneous token requests and logouts.
- Corrected checkAuthOnLoad error handling to prevent aggressive logouts on non-auth network errors.
- Added ability to edit client notes.
- Updated Client list UI to navigate directly to the full profile (`/tabs/clients/:id`) on click, bypassing the bottom sheet.
- Updated Client profile session history to display session price and location name instead of `isPaid` boolean.
- Added navigation from Client profile session history to the detailed Session edit page.

## Known Issues
- None. Build completes successfully.
