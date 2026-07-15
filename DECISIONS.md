# Architectural and Design Decisions (Client)

This document tracks important architectural, design, and business logic decisions made during the development of the FlowFit client application.

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
- **Decision:** Refactored `tabs.page.scss` to use `:host-context(.dark)` / `:host-context(.ion-palette-dark)` and added safe area inset calculations (`env(safe-area-inset-bottom)`).
- **Rationale:** Angular encapsulation prevented standard `body.dark` selectors inside component stylesheets from matching, causing the tab bar background to remain light-tinted in dark mode and leaving a visual gap at the bottom of iOS devices. Micro-sized icons (20px) and single-line truncated labels (10px) resolved tab item crowding.
- **Implementation:** Applied height adjustments (`calc(52px + env(safe-area-inset-bottom, 0px))`), custom safe area inset bottom padding, smaller icons, smooth active scaling transitions, and dark theme variables.
