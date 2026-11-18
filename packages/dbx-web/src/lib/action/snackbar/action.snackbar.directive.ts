import { Directive, type OnInit, inject, input } from '@angular/core';
import { cleanSubscriptionWithLockSet, DbxActionContextStoreSourceInstance, transformEmptyStringInputToUndefined } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type DbxActionSnackbarDisplayConfig, type DbxActionSnackbarEvent, type DbxActionSnackbarType } from './action.snackbar';
import { DbxActionSnackbarService } from './action.snackbar.service';
import { type DbxActionSnackbarDisplayConfigGeneratorFunction, type DbxActionSnackbarGeneratorInput, type DbxActionSnackbarGeneratorUndoInput } from './action.snackbar.generator';
import { type LoadingState, LoadingStateType, loadingStateType } from '@dereekb/rxjs';
import { DbxActionSnackbarUndoSource } from './action.snackbar.undo';

/**
 * Displays a Material snackbar notification when the parent action transitions between loading states
 * (loading, success, error). Supports built-in message presets via `dbxActionSnackbarDefault` and
 * custom generator functions via the `dbxActionSnackbar` input.
 *
 * To offer "Undo" after a success, bind `[dbxActionSnackbarUndoWork]` (see {@link DbxActionSnackbarUndoWorkDirective}) with the undo work,
 * or pass an undo getter/config to `[dbxActionSnackbarUndo]`. An explicit `[dbxActionSnackbarUndo]` wins over `[dbxActionSnackbarUndoWork]`.
 * The snackbar destroys the undo reference when it closes.
 *
 * @dbxWebComponent
 * @dbxWebSlug action-snackbar
 * @dbxWebCategory action
 * @dbxWebRelated action-snackbar-undo, action-snackbar-error, action-confirm, error-snackbar
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <div [dbxActionSnackbar]="fn"></div>
 * ```
 *
 * @dbxAction
 * @dbxActionSlug snackbar
 * @dbxActionRole directive
 * @dbxActionStateInteraction WORKING, RESOLVED, REJECTED
 * @dbxActionConsumesContext
 *
 * @example
 * ```html
 * <button [dbxAction]="saveAction" [dbxActionSnackbar]="snackbarFn">Save</button>
 * ```
 */
@Directive({
  selector: '[dbxActionSnackbar]'
})
export class DbxActionSnackbarDirective<T = unknown, O = unknown> implements OnInit {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });
  readonly dbxActionSnackbarService = inject(DbxActionSnackbarService);

  readonly dbxActionSnackbarDefault = input<Maybe<DbxActionSnackbarType>>();
  readonly dbxActionSnackbarUndo = input<Maybe<DbxActionSnackbarGeneratorUndoInput<T, O>>>();
  readonly dbxActionSnackbar = input<Maybe<DbxActionSnackbarDisplayConfigGeneratorFunction>, Maybe<DbxActionSnackbarDisplayConfigGeneratorFunction> | ''>(undefined, { transform: transformEmptyStringInputToUndefined });

  private readonly _undoSource = inject<DbxActionSnackbarUndoSource<T, O>>(DbxActionSnackbarUndoSource, { optional: true, self: true });

  protected readonly _sub = cleanSubscriptionWithLockSet({ lockSet: this.source.lockSet });

  ngOnInit(): void {
    this._sub.setSub(
      this.source
        .pipeStore((store) => store.loadingState$)
        .subscribe((loadingState: LoadingState<O>) => {
          const event: DbxActionSnackbarEvent<O> = { value: loadingState.value, error: loadingState.error, type: loadingStateType(loadingState) };

          const config = this.buildConfigurationForEvent(event);

          if (config) {
            this.showSnackbarForConfiguration(config, event);
          }
        })
    );
  }

  protected buildConfigurationForEvent(event: DbxActionSnackbarEvent<O>): Maybe<DbxActionSnackbarDisplayConfig<T, O>> {
    const input: DbxActionSnackbarGeneratorInput<T, O> = {
      event,
      undo: event.type === LoadingStateType.SUCCESS ? (this.dbxActionSnackbarUndo() ?? this._undoSource?.snackbarUndoInput()) : undefined // only show undo on success.
    };

    const snackbarFunction = this.dbxActionSnackbar();
    return snackbarFunction ? snackbarFunction(input) : this.dbxActionSnackbarService.generateDisplayConfig(this.dbxActionSnackbarDefault(), input);
  }

  protected showSnackbarForConfiguration(config: DbxActionSnackbarDisplayConfig<T, O>, _event: DbxActionSnackbarEvent<O>) {
    this.dbxActionSnackbarService.openSnackbar(config);
  }
}
