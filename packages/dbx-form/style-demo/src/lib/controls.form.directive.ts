import { Directive, computed, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, switchMap } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { filterMaybe } from '@dereekb/rxjs';
import { cleanSubscription } from '@dereekb/dbx-core';
import { AbstractSyncFormlyFormDirective, dbxFormSourceObservableFromStream } from '@dereekb/dbx-form';
import { type DbxStyleDemoControls } from '@dereekb/dbx-web/style-demo';

/**
 * Abstract base for the slim style-demo controls form components ({@link DbxFormStyleDemoPresetsComponent},
 * {@link DbxFormStyleDemoSectionsComponent}).
 *
 * Keeps a single `pickablechipfield` form in two-way sync with the playground's {@link DbxStyleDemoControls} (read from
 * the `controls` input). The controls UI lives in dbx-form because the pickable chip field is a `@dereekb/dbx-form`
 * field, which `@dereekb/dbx-web` cannot import.
 *
 * Both sync directions are driven off the form's state stream so they survive the component being recreated each time
 * the panel/popover reopens:
 *
 * - **Controls → form (seed):** {@link dbxFormSourceObservableFromStream} in `'reset'` mode re-pushes the controls
 *   state into the form every time the form enters its RESET state. This covers the initial ready transition — which
 *   only fires once the formly delegate has registered — so the chips seed from the live service state even though the
 *   delegate's `init` ignores the context's pending initial value. The `isSettingValue` guard filters the synchronous
 *   reset feedback `setValue` produces, exactly as `DbxFormSourceDirective` documents.
 * - **Form → controls (write-back):** only genuine user edits are applied. `setValue` marks the form pristine and
 *   untouched, so every seed / reset / initialization emission is `pristine: true`; the pickable chip field marks its
 *   control dirty on toggle, so a user edit is the only `pristine: false` emission. Filtering on that keeps init/reset
 *   noise from ever wiping the live service state.
 *
 * This directive is demo/debug-only and disposable — it is not a dbx-form core runtime primitive.
 *
 * @typeParam V - The form value type (a subset of the controls state: enabled sections or active presets).
 */
@Directive()
export abstract class AbstractDbxFormStyleDemoControlsFormDirective<V extends object> extends AbstractSyncFormlyFormDirective<V> {
  /**
   * The playground control surface to keep the chip field in sync with.
   */
  readonly controls = input<Maybe<DbxStyleDemoControls>>(undefined);

  /**
   * Guards the controls→form seed against the `setValue` → `resetForm` feedback loop: set before `setValue` and cleared
   * on the next microtask, so the synchronous reset emission `setValue` triggers on the stream is filtered out.
   */
  private _isSettingValue = false;

  /**
   * Builds the form value from the controls service signals.
   */
  protected abstract readControlsValue(controls: DbxStyleDemoControls): V;

  /**
   * Diff-applies the form value to the controls service via its setters, writing only the deltas.
   */
  protected abstract applyValueToControls(controls: DbxStyleDemoControls, value: V): void;

  /**
   * The controls state as a form value, recomputed whenever the controls signals change.
   */
  private readonly _controlsValue$ = toObservable(
    computed<Maybe<V>>(() => {
      const controls = this.controls();
      return controls == null ? undefined : this.readControlsValue(controls);
    })
  ).pipe(filterMaybe());

  /**
   * Controls → form: seed the form with the controls state on every RESET (see class docs).
   */
  protected readonly _seedFormSub = cleanSubscription(
    dbxFormSourceObservableFromStream(this.context.stream$.pipe(filter(() => !this._isSettingValue)), this._controlsValue$, 'reset').subscribe((value) => {
      this._isSettingValue = true;
      this.context.setValue(value);
      void Promise.resolve().then(() => (this._isSettingValue = false));
    })
  );

  /**
   * Form → controls: write back only genuine user edits (`pristine: false`), diff-applied as deltas (see class docs).
   */
  protected readonly _writeBackSub = cleanSubscription(
    this.context.stream$
      .pipe(
        filter((event) => event.pristine === false),
        switchMap(() => this.context.getValue())
      )
      .subscribe((value) => {
        const controls = this.controls();

        if (controls != null && value != null) {
          this.applyValueToControls(controls, value);
        }
      })
  );
}
