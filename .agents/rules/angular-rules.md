---
trigger: always_on
---

# Angular AI Agent Rules — FlowFit Client

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when the type is uncertain
- Group imports: Angular → Ionic → third-party → local
- Decorators should be placed at the top of the class
- Limit file size (if more than ~200–300 LOC try to split logic)
- Stream names end with `$`, booleans begin with `is`, `has`, or `can`

## Angular Best Practices

- Always use standalone components over NgModules
- Do NOT set `standalone: true` inside Angular decorators. It's the default
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use `@HostBinding` and `@HostListener`; use the `host` object in decorators instead
- Use `NgOptimizedImage` for static images (base64 not supported)
- Prefer `ChangeDetectionStrategy.OnPush` for better performance

## Architecture & Folder Structure

- Follow **LIFT**: Logical grouping, Isolated code, Flat structure, Try to stay DRY
- Use one concept per file: one component/service/directive per file
- Separate files for logic (.ts), template (.html), and styles (.scss)
- Use PascalCase for class names, camelCase for variables, kebab-case for filenames

## Component Structure

- Follow this order:
  1. Static properties
  2. Inputs / Outputs / Signals
  3. inject() calls
  4. Public/protected properties
  5. Getters
  6. Constructor (optional)
  7. Lifecycle hooks
  8. Public methods
  9. Private helpers

- Use `readonly` for inputs, injected services, and constants
- Use `protected` instead of `public` for template bindings
- Prefer input(), output() signal over @Input @Output decorators

## Signals Best Practices

- Use `signal()` for local reactive state
- Use `computed()` for derived state
- Use `effect()` for reacting to changes (e.g., logging or syncing)
- Avoid deeply nested POJO structures; use individual signals for fields
- Prefer `set()` and `update()` over `mutate()`
- Use `toSignal()` to bridge from `Observable` to `Signal`
- Always treat signal values as immutable

## Templates

- Avoid logic in templates; prefer computed properties or accessors
- Use native control flow: `@if`, `@for`, `@switch`
- Use `[class]` and `[style]` instead of `ngClass` and `ngStyle`
- Avoid multiple `async` pipes; use `@let` syntax

```html
@let user = user$ | async;
@if (user) {
  <div>{{ user.name }}</div>
}
```

## Dependency Injection

- Prefer `inject()` over constructor DI

## RxJS Best Practices

- PREFER USING SIGNALS over observables for component local state
- Use observables for heavy RxJS work
- Avoid nested `subscribe()` calls
- Use `switchMap`, `mergeMap`, or `concatMap` to flatten streams
- Use `takeUntilDestroyed()` for subscription cleanup
- Use `firstValueFrom()` instead of `.toPromise()`
- Avoid using `timer(0)` to trigger CD — use `NgZone.run()` or `ChangeDetectorRef`

## Component Performance

- Use `ChangeDetectionStrategy.OnPush`
- Use pure or memoized pipes for formatting or computation
