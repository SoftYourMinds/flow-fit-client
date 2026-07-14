# FlowFit Memory

## Current State
- UI/UX modernization fully implemented with Nude & Terracotta theme (#C88A72).
- Class-based `.dark` theme configured in `variables.scss` and `global.scss`.
- Scheduler supports Day, Week, and Month views, with horizontal week-strip navigation.
- Workout cards are clickable and open a detailed `session-detail` page.
- Payment tracking (`isPaid`) has been completely removed in favor of a simpler `price` per session model.
- `environment.ts` configured for local development (`http://localhost:4000`).

## Recent Changes
- Removed `isPaid` tracking from `SessionParticipant`.
- Renamed `pricePerPerson` to `price` in `WorkoutSession` (now represents the total price of the training).
- Replaced inline quick actions in Scheduler with a dedicated "Деталі тренування" (Session Detail) page.
- Sessions now display up to 3 participant avatars on the card.
- Fixed JWT refresh race condition on page reload that caused simultaneous token requests and logouts.
- Corrected checkAuthOnLoad error handling to prevent aggressive logouts on non-auth network errors.
- Added ability to edit client notes.

## Known Issues
- None. Build completes successfully.
