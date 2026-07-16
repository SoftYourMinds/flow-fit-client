# Architectural and Design Decisions (Client)

This document tracks important architectural, design, and business logic decisions made during the development of the FlowFit client application.

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
