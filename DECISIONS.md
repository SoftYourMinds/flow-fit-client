# Architectural and Design Decisions (Client)

This document tracks important architectural, design, and business logic decisions made during the development of the FlowFit client application.

## 2026-11-11: String-Aligned `ReminderMode` Presets Across Client & API
- **Decision:** Standardized `ReminderMode` and `REMINDER_MODE_LABELS` values in `NotificationService` as string literals (`'auto' | '15' | '30' | '60' | '120' | '180'`) instead of numeric minutes (`15 | 30 | ...`).
- **Rationale:** Backend `WorkoutSession.reminderMode` is stored as `String` in Prisma (`"auto"`, `"60"`, `"120"`). Sending numeric values (`60`, `120`) from Ionic `<ion-select>` caused Prisma to throw `500 Internal Server Error` on `POST /sessions` and `PUT /sessions/:id` in Vercel's serverless runtime, and prevented `<ion-select>` from matching saved string values when editing an existing session.
- **Implementation:**
  - `NotificationService`: Updated `ReminderMode` & `REMINDER_MODE_LABELS` to string values and used `Number(mode)` in `calcNotificationTime()`.
  - `CreateWizardModalComponent`, `SessionModalComponent`, `SessionDetailComponent`: Normalized `reminderMode` via `String(...)` on load and submission.

## 2026-11-11: PWA Web Push & Critical Dual-Channel Notifications
- **Decision:** Upgraded `NotificationService` to support Progressive Web Applications (PWA) via `@angular/service-worker` (`SwPush`), while preserving native `@capacitor/local-notifications` when running in native shells. Added backend persistence for workout notification settings (`enableNotification`, `reminderMode`, and `isCritical`).
- **Rationale:** When running as a PWA, `Capacitor.isNativePlatform()` returns `false`, causing all local scheduling calls to exit early. Furthermore, form modal handlers previously deleted `enableNotification` and `reminderMode` before sending payload to the API. Now, notification preferences are persisted in the backend database, allowing the server scheduler to trigger Web Push and Telegram notifications even when the client is closed.
- **Implementation:**
  - `NotificationService`: Injected optional `SwPush` and `HttpClient`, added `subscribeToPush()` fetching backend VAPID key and registering endpoint.
  - Form modals (`CreateWizardModalComponent`, `SessionModalComponent`, `SessionDetailComponent`):
    - Added "🔥 Критичне сповіщення" toggle (Telegram + Web Push).
    - Preserved `enableNotification`, `reminderMode`, `isCritical` in API payloads.
    - Updated UI using modern Angular control flow (`@if`).
  - `SettingsComponent`: Added push unsubscribe handling when notifications are toggled off.

## 2026-11-10: Scheduler Filtering Architecture & Multi-View Reactive Synchronization
- **Decision:** Decoupled criteria-based filtering (`criteriaFilteredSessions`: status, type, location, workout types) from date-range filtering, and synchronized criteria-filtered data across all three scheduler views (Day, Week, Month).
- **Rationale:** Previously, filters only operated on Day view because Week and Month views directly received unfiltered `sessions()`, rendering location, type, status, and workout type filters completely non-functional in Week and Month views. In addition, `filterLocationId` suffered from `null` vs numeric mismatch in `ion-select`, workout types had case-sensitive string matching bugs, and filter chips shrank horizontally on mobile screens, severely truncating their text labels to 3-4 letters.
- **Implementation:**
  - `SchedulerComponent`:
    - Defined `criteriaFilteredSessions`: applies status (`SessionStatus`), session type (`SessionType`), location (`Number(locId)` matching both `session.locationId` and `session.location.id`), and case-insensitive workout type matching.
    - Updated `WeekViewComponent` and `MonthViewComponent` input bindings to receive `criteriaFilteredSessions()`, allowing instant reactive filtering of calendar event dots, active-day session lists, and weekly timetables.
    - Day View week navigation strip (`weekDays` signal) counts now compute from `criteriaFilteredSessions()`, ensuring day badge counts accurately reflect active filters.
    - Location filter initialized to `'ALL'` and properly normalizes string/number/null inputs via `onLocationChange`.
    - Added `hasActiveFilters` computed signal, `resetFilters()` button in UI, and active filter styling (`.active-filter`) on chips.
    - SCSS: added `flex-shrink: 0; white-space: nowrap;` to `.filter-chip` and horizontal scroll optimization so filter labels remain legible on mobile.
  - `MonthViewComponent`: added location tag display to each session item under the calendar.

## 2026-10-23: Dynamic Theme System with Ready Presets & Custom Palette Builder
- **Decision:** Replaced hardcoded binary light/dark mode with dynamic, token-driven theming architecture supporting curated presets, user-defined custom color themes, and automatic harmonic color calculations.
- **Rationale:** Fitness trainers and power users require personalization that matches their visual taste, gym branding, or mood, rather than restricting them to default black and white/terracotta.
- **Implementation:**
  - `theme.types.ts`: Strongly typed interfaces (`ThemePreset`, `CustomThemeConfig`, `ThemeMode`, `DarkBgTone`).
  - `theme-utils.ts`: Pure mathematical color utilities for RGB/Hex/HSL conversion, ITU-R perceived luminance calculation, automatic contrast switching (`#ffffff` vs `#141211`), automatic tint/shade derivations, step variables generation (`--ion-color-step-50`..`950`), and runtime CSS generation.
  - `ThemeService`: Reactive Angular signals (`themeMode`, `isDark`, `activePresetId`, `customConfig`, `activePreset`). Injects dynamic CSS rules into a runtime `<style id="flowfit-theme-runtime">` stylesheet and updates root custom properties simultaneously.
  - Backward compatibility: Retained `isDarkMode`, `setDarkMode`, and `toggleTheme` to preserve compatibility with existing callers.
  - `settings.component`: Modern visual preset cards with 3-dot color previews, mode segment (Light/Dark/System Auto), expandable custom color picker with native color input + hex field, quick palette recommendations, auto-harmonize button, and live preview box.

## 2026-07-16: Local Notifications vs Background Sync
- **Decision:** Implemented workout reminders using `@capacitor/local-notifications` rather than a background service or Web Worker.
- **Rationale:** Background processes are unreliable on iOS (they get suspended). Local notifications operate on a "schedule and forget" principle: the OS guarantees delivery at the specified time even if the app is completely closed. This perfectly fits the atomic nature of workout reminders.
- **Implementation:** 
  - `NotificationService` handles calculating the reminder time based on the session's start time.
  - Limits are respected by maintaining maximum 50 scheduled notifications at any time.
  - State is synchronized every time the app resumes via `App.addListener('appStateChange')` to clear stale notifications.

## 2026-07-15: Training Pricing and Payment Tracking
- **Decision:** Removed per-client `isPaid` tracking and replaced `pricePerPerson` with a single `price` field representing the total cost of the training session.
- **Rationale:** The business model shifted from tracking individual client payments for a session to simply tracking the total expected revenue for the session as a whole. This simplifies the UX and reduces overhead for the trainer.
- **Implementation:** 
  - The UI for "Оплачено" toggles on individual workout cards was removed.
  - A new "Session Detail" page was introduced to provide a cleaner interface for editing the total `price`, managing participants, and changing the session status (Active, Completed, Missed).
  - Unpaid session warnings were removed from the Reports page.

## 2026-07-15: Modern Glassmorphism UI
- **Decision:** Adopted a class-based `.dark` theme using the Nude & Terracotta palette (`#C88A72`).
- **Rationale:** To provide a premium, modern aesthetic that appeals to fitness professionals.
- **Implementation:** Extensive use of CSS variables in `variables.scss` and `global.scss`, implementing translucent backgrounds and rounded corners across all major components (cards, bottom sheets).

## 2026-07-15: Bottom Toolbar & Safe-Area Redesign
- **Decision:** Shifted to a 4 Core Tabs + "Більше" (More) ActionSheet Drawer layout (*Клієнти*, *Розклад*, *Звіти*, *Більше*). Refactored `tabs.page.scss` to use `:host-context(.dark)` / `:host-context(.ion-palette-dark)` and added safe area inset calculations (`env(safe-area-inset-bottom)`).
- **Rationale:** Reduces horizontal overcrowding, increases individual touch targets, and allows lower-frequency pages (*Локації*, *Налаштування*, *Тема*) to sit inside an elegant glassmorphism action sheet. Angular encapsulation prevented standard `body.dark` selectors inside component stylesheets from matching, which was fixed via `:host-context`.
- **Implementation:** Configured 4 main tab buttons, `openMoreMenu()` ActionSheet trigger, glassmorphism CSS in `global.scss`, height adjustments (`calc(52px + env(safe-area-inset-bottom, 0px))`), and dark theme custom properties.
