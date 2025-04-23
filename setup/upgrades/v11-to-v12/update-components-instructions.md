# Angular 16 → 18 Migration Checklist

Follow these deterministic steps for **every** component/directive. The wording is optimized so humans **and** automation scripts can apply it verbatim.

---
## 1  Component / Directive Metadata

* `standalone: true`
* `changeDetection: ChangeDetectionStrategy.OnPush`
* `imports: [ … ]` for everything referenced in the template  
  (omit `NgIf`, `NgSwitch`, `NgSwitchCase`; ignore temporary TS‑import errors)

---
## 2  Dependency Injection

Delete constructor parameters; re‑declare them as:

```ts
private readonly foo = inject(FooService);
```

---
## 3  Inputs, Outputs & View Queries

| Angular 16                           | Angular 18 replacement                              |
|--------------------------------------|-----------------------------------------------------|
| `@Input() foo?: T;`                  | `readonly foo = input<Maybe<T>>();`                 |
| `@Output() bar = new EventEmitter<U>();` | `readonly bar = output<U>();`                     |
| `@ViewChild(ref) tpl!: TemplateRef<…>;` | `readonly tpl = viewChild<TemplateRef<…>>(ref);`   |

Notes
* No `EventEmitter.unsubscribe()`; delete related `ngOnDestroy` logic.
* If `ngOnDestroy` becomes empty, remove the method **and** `implements OnDestroy`.

---
## 4  Signals vs RxJS

### General Rules
1. Expose any remaining `Observable` to the template via `toSignal(obs$)` → `fooSignal`.
2. Convert a `BehaviorSubject` to a real `signal` **only when**
   * its value comes from an `@Input`, **and**
   * the template previously consumed it with `| async`.

### Naming Conventions
| Kind      | Declaration example                                        | Template call |
|-----------|------------------------------------------------------------|---------------|
| Private   | `private readonly _countSignal = signal<number>(0);`       | –             |
| Public RO | `readonly countSignal = this._countSignal.asReadonly();`   | `countSignal()` |
| Derived   | `readonly totalSignal = computed(() => …);`                | `totalSignal()` |
| `input()` | `readonly size = input<Maybe<number>>();` (no “Signal” suffix) | `size()` |

*Do **not** wrap a single signal in a pointless `computed(() => sig())`.*

---
## 5  Template Control‑Flow & Bindings

| Angular 16 Snippet                    | Angular 18 Replacement                        |
|--------------------------------------|----------------------------------------------|
| `{{ obs$ \| async }}`                | `{{ obsSignal() }}`                           |
| `*ngIf="cond"`                       | `@if (cond) { … }`                            |
| `*ngSwitch="val"` / `*ngSwitchCase` | `@switch (val) { @case (…) { … } }`           |

---
## 6  Coding Conventions & Anti‑Patterns

* Mark fields `readonly` where feasible.
* Prefer explicit setter methods (`setFoo(x)`) over property setters—unless using `input()`.
* Avoid redundant “state” signals that only mirror another signal or input.
* Avoid `computed(() => this.foo())`; call `this.foo()` directly.

Apply the checklist top‑to‑bottom to guarantee a clean Angular 18 upgrade.