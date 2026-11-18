import { DestroyRef, Directive, effect, inject, model, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { areEqualPOJOValues, type Maybe } from '@dereekb/util';
import { combineLatest, distinctUntilChanged, filter, map } from 'rxjs';
import { DbxLlmFlowSectionFormBindingTarget } from './llm.flow';
import { cleanSubscription } from '@dereekb/dbx-core';

interface DbxLlmFlowSectionValueRef {
  readonly value: unknown;
}

interface DbxLlmFlowSectionValueSeed<F> {
  readonly seed: Maybe<F>;
}

/**
 * Binds a value to the nearest section's form value, both ways, the way dbxLlmFlowSectionForm binds a form. Use it to keep a view-only section's
 * state (see DbxLlmFlowSectionConfig.viewOnly) in a signal of the page, with plain buttons or any custom input instead of a form.
 *
 * - Changes of the bound value are pushed to the section as a form binding, so its own changes don't echo back.
 * - Changes made elsewhere (loading a run from history, restoring the flow, a reset, other bindings, setFormValue()) are written to the bound
 *   value.
 * - While the section locks its forms (such as while the flow restores), changes are not pushed, and seeds wait until it unlocks.
 * - On the first seed, a section without a value takes the bound value, so a page default flows into the store. Declare the starting value on
 *   the config's initialDraft.formValue instead to keep it through resets.
 *
 * The value must be JSON-compatible. Exported as dbxLlmFlowSectionValue, with lockedSignal for disabling the page's controls.
 *
 * @example
 * ```html
 * <dbx-llm-flow-section [config]="setupConfig">
 *   <div [(dbxLlmFlowSectionValue)]="setupState" #setup="dbxLlmFlowSectionValue">
 *     <dbx-button text="Host the world" [disabled]="setup.lockedSignal()" (buttonClick)="host()"></dbx-button>
 *   </div>
 * </dbx-llm-flow-section>
 * ```
 */
@Directive({
  selector: '[dbxLlmFlowSectionValue]',
  exportAs: 'dbxLlmFlowSectionValue',
  standalone: true
})
export class DbxLlmFlowSectionValueDirective<F = unknown> {
  readonly target = inject(DbxLlmFlowSectionFormBindingTarget<F>);

  /**
   * The bound value. Two-way: [(dbxLlmFlowSectionValue)]="signal".
   */
  readonly dbxLlmFlowSectionValue = model<Maybe<F>>();

  /**
   * Whether the section locks its forms. Changes made while locked are not pushed.
   */
  readonly lockedSignal = toSignal(this.target.formLocked$, { initialValue: false });

  private readonly _binding = this.target.registerFormBinding();
  private readonly _seedSub = cleanSubscription();

  private _seeded = false;
  private _synced: Maybe<DbxLlmFlowSectionValueRef>;

  constructor() {
    this._seedSub.subscription = combineLatest([this.target.formSeed$(this._binding.id).pipe(map((seed): DbxLlmFlowSectionValueSeed<F> => ({ seed }))), this.target.formLocked$])
      .pipe(
        filter(([, locked]) => !locked),
        map(([seed]) => seed),
        distinctUntilChanged() // a seed is applied once, even when the lock toggles
      )
      .subscribe(({ seed }) => this._applySeed(seed));

    effect(() => {
      const value = this.dbxLlmFlowSectionValue();
      untracked(() => this._pushValue(value));
    });

    inject(DestroyRef).onDestroy(() => this._binding.destroy());
  }

  private _applySeed(seed: Maybe<F>): void {
    const firstSeed = !this._seeded;
    const current = this.dbxLlmFlowSectionValue();
    this._seeded = true;

    if (firstSeed && seed == null) {
      this._synced = { value: undefined };
      this._pushValue(current); // the section has no value yet: the bound value flows in
    } else {
      this._synced = { value: seed };

      if (!areEqualPOJOValues(current, seed)) {
        this.dbxLlmFlowSectionValue.set(seed);
      }
    }
  }

  private _pushValue(value: Maybe<F>): void {
    if (this._seeded && !this.lockedSignal() && (this._synced == null || !areEqualPOJOValues(this._synced.value, value))) {
      this._synced = { value };
      this.target.setDraftFormValue(this._binding.id, value);
    }
  }
}
