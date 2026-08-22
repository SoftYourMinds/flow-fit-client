---
trigger: always_on
---

# Angular & Ionic Project Standards — FlowFit Client

## Architecture & State

- Use standalone components (no NgModules).
- Manage local state with Angular Signals (`signal()`, `computed()`, `linkedSignal()`, `toSignal()`).
- Avoid `effect()` for state management; use `computed()` for derived state.
- Use `inject()` for Dependency Injection across all components, directives, pipes, and services (never constructor parameter injection).
- Always specify `ChangeDetectionStrategy.OnPush` on components.
- Use native template control flow (`@if`, `@for`, `@switch`).
- Enable `"strict": true` in `tsconfig.json`. Never use `any`.

## Code Organization & Structure

Maintain standard ordering in component and service classes:
1. Static properties / constants
2. Signals (inputs, model, state signals, computed signals)
3. Injected dependencies (`inject()`)
4. Public & protected methods
5. Lifecycle hooks (`OnInit`, `ViewWillEnter`, `OnDestroy`, etc.)
6. Private helper methods

## Clean Code & Refactoring Rules

**CRITICAL TRIGGER:** You MUST review your generated and modified code against these rules as a final step before presenting it to the user.

1. **Guard Clauses over Nested `if`s**
   Exit early, do not nest logic. If an `if` block ends with a `return`, it is a guard clause. Guard clauses must go first and should not be nested.
   _Bad:_ `if (a) { if (b) { do() } }`
   _Good:_ `if (!a) return; if (b) do();`

2. **Combine Conditions**
   Combine conditions instead of nesting them (e.g., `if (a && b) { ... }`).
   _Exception:_ Only separate them if each condition requires a different side-effect or error message.

3. **`return promise` instead of `await` in void methods**
   In `async` functions returning `Promise<void>`, forwarding the promise is cleaner than `await`ing it.
   _Bad:_ `await this.loadData(); return;`
   _Good:_ `return this.loadData();`
   _Exception:_ Use `return await` if inside a `try/catch` block for better stack traces.

4. **Extract Private Methods with Expressive Names**
   Each distinct operation is a separate private method. The name must describe the intent, not the mechanism.
   _Rule:_ If you need a comment to explain a block of code, extract it into a method with a descriptive name.

5. **One Method — One Responsibility**
   Public methods describe _what_ happens (orchestration). Private methods describe _how_ it happens (implementation details).

6. **Explicit Return Types on All Methods**
   Always declare return types on methods and helper functions (e.g., `loadSessions(): Promise<void> {`).

7. **File Structure — Sections via Comments**
   Maintain clean section separation in services and complex components:
   `// ─── Public Methods ─────────────────────────────────────────────`
   `// ─── Business Logic ─────────────────────────────────────────────`
   `// ─── Private Helpers ────────────────────────────────────────────`

8. **Boolean Checks in Descriptive Variables**
   If a boolean expression requires mental parsing, extract it into a descriptively named variable.
   _Bad:_ `if (!prev && current) { ... }`
   _Good:_ `const toggledOn = !prev && current; if (toggledOn) { ... }`
