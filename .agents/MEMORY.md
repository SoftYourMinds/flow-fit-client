# MEMORY.md — flow-fit-client

> **Protocol:** Read this file at the start of every session before taking any action.
> **Update trigger:** Run the `memory-manager` skill after any major feature, refactor, or debugging session.

---

## 📊 PROJECT LEVEL

- **Active Level:** **Level 1 (MVP)**
- **Architectural Philosophy:** Speed and simplicity. Angular Signals for state, no external state management library.

---

## 🪵 ACTIVE TECH DEBT & ACCEPTABLE HACKS

_(empty — fresh project, no tech debt yet)_

---

## WHAT — Project Context

**Project:** `flow-fit-client` — Mobile-first Ionic+Angular CRM for fitness coaches.
**Stack:** Ionic 8 · Angular 20 · Standalone Components · Signals · REST API (HttpClient)

### State Management

- **Angular Signals only** — no NGXS, no NgRx
- `signal()` for local mutable state (loading flags, form values, UI toggles)
- `computed()` for all derived state (filtered lists, conditional UI)
- Services expose signals, components consume them
- `toSignal()` from `@angular/core/rxjs-interop` to bridge HttpClient Observables

### Data Flow Pattern

1. **Services** make HTTP calls via `HttpClient`, expose reactive data as signals
2. **Components** inject services, consume signals via `computed()` and template bindings
3. **Route resolvers** (optional) pre-fetch data before route activates
4. **No query params for data that lives in services** — use service signals

### Component Patterns

- Standalone components only (no NgModules)
- `inject()` for dependency injection (no constructor DI)
- `ChangeDetectionStrategy.OnPush` for all components
- `@if` / `@for` / `@switch` control flow (no *ngIf/*ngFor)
- `input()` / `output()` signal APIs (no @Input/@Output decorators)

### Design System

**Theme:** Light (warm)

| Token               | Value     | Usage                           |
| ------------------- | --------- | ------------------------------- |
| Primary (Peach)     | `#FFB3A7` | Buttons, active states, accents |
| Secondary (Magenta) | `#B55C82` | Secondary actions, highlights   |
| Success (Olive)     | `#829368` | Success states, completed       |
| Dark Text           | `#4A3034` | Primary text color              |
| Background          | `#FDFBF9` | Page background                 |
| Font                | Outfit    | Google Fonts                    |

### Status Badge Colors

| Status          | Color     | Label                |
| --------------- | --------- | -------------------- |
| UPCOMING        | `#6B7280` | Заплановано          |
| ACTIVE          | `#3B82F6` | Зараз йде            |
| REQUIRED_ACTION | `#F59E0B` | Потрібна дія         |
| COMPLETED       | `#829368` | Завершено            |
| MISSED          | `#EF4444` | Пропущено            |

### Navigation (App Routes)

```
/auth/login
/auth/register
/tabs/
├── scheduler      (Calendar + List views)
├── clients        (Client list)
├── reports        (Analytics)
└── settings       (Profile + Telegram)
/clients/:id       (Client profile with tabs)
/sessions/new      (Create session)
/sessions/:id      (Session detail)
/locations          (Locations management)
```

---

## HOW — Workflow & Commands

### Dev & Build

```bash
npm start              # ionic serve (default port 8100)
npm run build          # production build
npm run lint           # ESLint check
```

### Git Commits

Use `/git-commit` workflow. Format: `type(scope): description` (Conventional Commits).

### Code Style

- `strict: true` in tsconfig
- No `any` types
- Import order: Angular → Ionic → third-party → local
- Enums over magic strings
- `async/await` only
