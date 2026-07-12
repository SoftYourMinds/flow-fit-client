# FlowFit Client — Architectural Decisions

## ADR-001: Signals-Only State Management
- **Date**: 2026-07-12
- **Decision**: Use Angular Signals (`signal()`, `computed()`, `toSignal()`) as the sole state management solution. No external library (NGXS, NgRx, etc.).
- **Rationale**: For an MVP CRM with relatively simple state (client list, session list, user profile), Angular Signals provide sufficient reactivity without the boilerplate overhead of a state management library. This keeps the codebase lean and reduces the learning curve. If the application grows significantly in complexity, a state manager can be introduced later.

## ADR-002: REST API Client via HttpClient + Interceptors
- **Date**: 2026-07-12
- **Decision**: Use Angular `HttpClient` directly with a JWT interceptor for API communication. No GraphQL, no code generation.
- **Rationale**: The backend exposes a REST API with Swagger docs. HttpClient is the native Angular solution, and a simple interceptor pattern handles JWT token attachment and refresh. This avoids the complexity of Apollo Client / GraphQL codegen for a straightforward CRUD app.

## ADR-003: Mobile-First Ionic Layout
- **Date**: 2026-07-12
- **Decision**: Design and implement all screens mobile-first. Use Ionic's tab-based navigation as the primary layout.
- **Rationale**: The primary user (fitness trainer) will use the app on their phone between sessions. Ionic provides native-like mobile components (tabs, modals, action sheets) out of the box. Desktop responsiveness can be added later with CSS breakpoints.

## ADR-004: Light Theme with Warm Floral Palette
- **Date**: 2026-07-12
- **Decision**: Use a light (warm) theme with the color palette: Primary `#FFB3A7` (Peach), Secondary `#B55C82` (Magenta), Success `#829368` (Olive Green), Text `#4A3034`, Background `#FDFBF9`.
- **Rationale**: Based on user's design reference (floral notebook). The warm, light palette creates a friendly, approachable feel appropriate for a fitness coaching app. The "Outfit" Google Font adds a modern, clean typography.

## ADR-005: Ukrainian UI Language (No i18n Framework)
- **Date**: 2026-07-12
- **Decision**: All UI text is hardcoded in Ukrainian. No i18n framework for MVP.
- **Rationale**: The target audience is Ukrainian trainers. Adding `@angular/localize` or `ngx-translate` for a single language adds unnecessary complexity. i18n can be retrofitted later if the product expands to other markets.

## ADR-006: Ionic Lifecycle Hooks for Data Fetching
- **Date**: 2026-07-12
- **Decision**: Use `ionViewWillEnter` instead of `ngOnInit` for data fetching on pages that may be cached by Ionic's navigation stack.
- **Rationale**: Ionic caches pages in the navigation stack — `ngOnInit` only fires once. `ionViewWillEnter` fires every time the page becomes visible (including re-entering from back navigation), ensuring data is always fresh.
