You are updating Angular components that use the AsyncPipe pipe to instead use Angular Signals. You are updating to Angular 18 signals.

The goal is to eliminate every `…$ | async` expression and expose a `…Signal()` (or `signalName()`) call in its place while keeping existing behavior intact. Follow the workflow below for EACH component/directive.

──────────────────────────────────────────────────
1. Locate every template reference that uses `| async`
──────────────────────────────────────────────────
• Search the template for `$ | async`.  
• Make a list of the observable property names (`foo$`, `bar$`, …) and all template occurrences.

──────────────────────────────────────────────────
2. Class-side conversion strategy
──────────────────────────────────────────────────
For EACH observable from step 1 decide which path to take:

A. FULL conversion to pure-signal (use `computed()` / `input()`)  
   Choose this when the observable is built only from:
   • Local `BehaviorSubject`s created inside the same class.  
   • Simple RxJS operators (`map`, `combineLatest`, `distinctUntilChanged`, …).  
   • Values supplied by `@Input` getter/setters that merely proxy to the local `BehaviorSubject`.

   Implementation:
   1. Replace each `BehaviorSubject` with the corresponding **signal input**:
      ```ts
      // Before
      private readonly _valueSubject = new BehaviorSubject<Maybe<number>>(0);
      @Input() set value(v: Maybe<number>) { this._valueSubject.next(v); }
      get value(): Maybe<number> { return this._valueSubject.value; }

      readonly value$ = this._valueSubject.asObservable();
      ```

      ```ts
      // After
      readonly value = input<Maybe<number>>(0);           // NO suffix for inputs
      ```

   2. Convert derived streams to **computed signals**:
      ```ts
      // Before
      readonly doubled$ = this.value$.pipe(map(v => (v ?? 0) * 2));
      ```

      ```ts
      // After
      readonly doubledSignal = computed(() => (this.value() ?? 0) * 2);
      ```

B. BRIDGE conversion (keep observable, expose signal via `toSignal()`)
   Choose this when the observable chain includes *any* external source (services, facades, router events, NgRx selectors, etc.) and rewriting it would be risky or verbose.

   Implementation:
   ```ts
   // Keep existing observable
   readonly data$ = this.someService.data$;

   // Add bridging signal
   readonly dataSignal = toSignal(this.data$, { initialValue: /* reasonable default */ undefined });
   ```

──────────────────────────────────────────────────
3. Naming conventions
──────────────────────────────────────────────────
• Observable `$` suffix ➜ Signal `Signal` suffix.  
• Signals referenced by the template MUST be **public** and callable: `fooSignal()`  
• Private helper signals: `private readonly _fooSignal = signal<T>(initial)`  
  Expose read-only view if needed:  
  `readonly fooSignal = this._fooSignal.asReadonly();`

──────────────────────────────────────────────────
4. Template updates
──────────────────────────────────────────────────
Replace every `…$ | async` with `…Signal()`:

Before                          ➜ After
--------------------------------------------------------------
`{{ total$ | async }}`          ➜ `{{ totalSignal() }}`
`[href]="url$ | async"`         ➜ `[href]="urlSignal()"`
`*ngIf="items$ | async as items"`
➜ `@if (itemsSignal() as items) { … }`

(Structural control-flow syntax such as `@if`, `@for`, `@switch` is already assumed to be migrated.)

──────────────────────────────────────────────────
5. Decorator tweaks
──────────────────────────────────────────────────
In the `@Component` / `@Directive` metadata:
• Ensure `changeDetection: ChangeDetectionStrategy.OnPush` is present.  
• Remove `AsyncPipe` from the `imports:` array (or from any legacy `pipes:` field).  
• Do NOT add `NgIf`, `NgSwitch`, or `NgSwitchCase` as imports.  
• If the file hasn’t already been migrated to standalone add `standalone: true` (per v18 rules).

──────────────────────────────────────────────────
6. Module cleanup
──────────────────────────────────────────────────
Delete any explicit `AsyncPipe` symbols from `import` statements:
```ts
// Before
import { AsyncPipe, NgIf } from '@angular/common';
// After
import { NgIf } from '@angular/common';
```

──────────────────────────────────────────────────
7. Quick checklist (per file)
──────────────────────────────────────────────────
☐ Every `$ | async` is gone.  
☐ A corresponding `Signal` property exists and is public if needed.  
☐ Template uses `signalName()` calls.  
☐ No remaining `AsyncPipe` imports/usages.  
☐ `OnPush` change-detection added.  
☐ Component is `standalone: true` (unless already standalone).

──────────────────────────────────────────────────
8. Reference snippets (from update-component-examples.ts)
──────────────────────────────────────────────────
• **Bridge pattern (toSignal)**  
  ```ts
  readonly contextStream$ = source$.pipe(shareReplay(1));
  readonly contextStreamSignal = toSignal(this.contextStream$);
  ```

• **Pure computed**  
  ```ts
  readonly disabledSignal = computed(() => this.loading() || !!this.error());
  ```

Use these patterns verbatim to keep styling consistent with the reference file.

──────────────────────────────────────────────────
9. Done!
──────────────────────────────────────────────────
After applying the above rules, the component/directive should compile with zero `AsyncPipe` references and function identically while benefiting from Angular 18’s reactive signals API.
