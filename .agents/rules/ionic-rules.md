---
trigger: always_on
description: Ionic-specific development rules for mobile-first FlowFit client
---

# Ionic Development Rules — FlowFit Client

## Lifecycle Hooks

- **Use `ionViewWillEnter`** instead of `ngOnInit` for data fetching on pages that may be cached
- Ionic caches pages in the navigation stack — `ngOnInit` only fires once
- `ionViewWillEnter` fires every time the page becomes visible (re-entering from back nav)
- Implement `ViewWillEnter` interface from `@ionic/angular/standalone`

## Navigation Patterns

- Use tab-based navigation as the primary layout
- Use `NavController` for programmatic navigation within tabs
- Use Ionic modals for create/edit forms
- Use action sheets for quick actions (status changes, delete confirmations)
- Use `ion-back-button` for sub-page navigation

## Component Usage

- Prefer Ionic components over raw HTML elements for consistent mobile UX:
  - `ion-list`, `ion-item` for lists
  - `ion-card` for content cards
  - `ion-fab` for floating action buttons
  - `ion-searchbar` for search
  - `ion-segment` for tabs/filters within a page
  - `ion-refresher` for pull-to-refresh
  - `ion-infinite-scroll` for pagination
  - `ion-datetime` for date/time pickers
  - `ion-modal` for modals
  - `ion-toast` for notifications

## Mobile-First Design

- Design for 375px viewport first, then scale up
- Use Ionic's responsive grid (`ion-grid`, `ion-row`, `ion-col`) for layouts
- Touch targets must be at least 44x44px
- Use `ion-padding` and `ion-margin` classes for consistent spacing
- Test with iOS and Material Design themes

## Forms

- Use Reactive Forms with `FormBuilder` + `Validators`
- Display validation errors below inputs using `ion-note` with `color="danger"`
- Use `ion-input`, `ion-textarea`, `ion-select` for form controls
- Show loading state during form submission (disable button + spinner)

## Performance

- Lazy load feature routes
- Use `trackBy` function in `@for` loops
- Minimize DOM elements in lists (use virtual scroll for large lists with `ion-virtual-scroll` or CDK)
