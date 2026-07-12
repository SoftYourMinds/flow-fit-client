---
trigger: always_on
description: Guidelines for managing local component state using Angular Signals
---

# Local Component State Guidelines

This project leverages Angular Signals as the primary mechanism for managing local component state. Follow these core principles to ensure predictability and maintainability:

## 1. Use Signals for Local Reactive State
- Use `signal()` to define base, mutable states (e.g., UI toggles, active tabs, form loading indicators).
- Use `update()` or `set()` to modify signal values.
- Treat signal payloads as immutable. If you are holding objects or arrays in a signal, do not mutate them directly; replace them with a new reference.

## 2. Leverage Computed for Derived State
- Use `computed()` exclusively for state that can be derived synchronously from other signals.
- Computed signals are heavily optimized, memoized, and lazy. They should be pure functions with no side-effects.
- Never trigger state mutations (API calls, side effects, or setting other signals) inside a `computed()` function.

## 3. Avoid `effect()` for Complex State
> [!WARNING]
> Do **NOT** use `effect()` to manage or synchronize complex state. 

- `effect()` should be treated strictly as an escape hatch, primarily reserved for things like logging, syncing with local storage, or interacting with non-reactive/third-party APIs (like a vanilla JS chart library).
- Overusing `effect()` for state synchronization creates unpredictable cascading updates and makes debugging exponentially harder. 
- If you find yourself updating a signal inside an `effect()`, you probably need a `computed()` signal instead, or you need to re-evaluate your data flow architecture.

## 4. Bridging Observables
- When consuming HTTP responses (`HttpClient` Observables), use `toSignal()` (from `@angular/core/rxjs-interop`) to cleanly bring them into the local signal context.
- Try to resolve asynchronous data flows in the service layer, keeping the component focused strictly on mapping signals to the view.

## 5. Service-Level State Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly http = inject(HttpClient);
  
  // Writable signal for the clients list
  private readonly _clients = signal<Client[]>([]);
  
  // Public read-only signal
  readonly clients = this._clients.asReadonly();
  
  // Derived state
  readonly activeClients = computed(() => 
    this._clients().filter(c => c.isActive)
  );
  
  readonly isLoading = signal(false);

  async loadClients(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await firstValueFrom(this.http.get<Client[]>('/api/clients'));
      this._clients.set(data);
    } finally {
      this.isLoading.set(false);
    }
  }
}
```
