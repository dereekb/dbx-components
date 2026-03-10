import { Directive, type OnInit, inject, input } from '@angular/core';
import { cleanSubscriptionWithLockSet, DbxActionContextStoreSourceInstance, transformEmptyStringInputToUndefined } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type DbxActionSnackbarDisplayConfig, type DbxActionSnackbarEvent, type DbxActionSnackbarType } from './action.snackbar';
import { DbxActionSnackbarService } from './action.snackbar.service';
import { type DbxActionSnackbarDisplayConfigGeneratorFunction, type DbxActionSnackbarGeneratorInput, type DbxActionSnackbarGeneratorUndoInput } from './action.snackbar.generator';
import { type LoadingState, LoadingStateType, loadingStateType } from '@dereekb/rxjs';

/**
 * Displays a Material snackbar notification when the parent action transitions between loading states
 * (loading, success, error). Supports built-in message presets via `dbxActionSnackbarDefault` and
 * custom generator functions via the `dbxActionSnackbar` input.
 *
 * @example
 * ```html
 * <form [dbxAction]="saveAction" dbxActionSnackbar dbxActionSnackbarDefault="save">
 *   <!-- Shows "Saving...", "Saved", or "Save Failed" snackbars automatically -->
 * </form>
 * ```
 *
 * @example
 * ```html
 * <div [dbxAction]="deleteAction" [dbxActionSnackbar]="customSnackbarFn" [dbxActionSnackbarUndo]="undoRef">
 *   <!-- Custom snackbar with undo support -->
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxActionSnackbar]',
  standalone: true
})
export class DbxActionSnackbarDirective<T = unknown, O = unknown> implements OnInit {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });
  readonly dbxActionSnackbarService = inject(DbxActionSnackbarService);

  readonly dbxActionSnackbarDefault = input<Maybe<DbxActionSnackbarType>>();
  readonly dbxActionSnackbarUndo = input<Maybe<DbxActionSnackbarGeneratorUndoInput<T, O>>>();
  readonly dbxActionSnackbar = input<Maybe<DbxActionSnackbarDisplayConfigGeneratorFunction>, Maybe<DbxActionSnackbarDisplayConfigGeneratorFunction> | ''>(undefined, { transform: transformEmptyStringInputToUndefined });

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
      undo: event.type === LoadingStateType.SUCCESS ? this.dbxActionSnackbarUndo() : undefined // only show undo on success.
    };

    const snackbarFunction = this.dbxActionSnackbar();
    return snackbarFunction ? snackbarFunction(input) : this.dbxActionSnackbarService.generateDisplayConfig(this.dbxActionSnackbarDefault(), input);
  }

  protected showSnackbarForConfiguration(config: DbxActionSnackbarDisplayConfig<T, O>, event: DbxActionSnackbarEvent<O>) {
    this.dbxActionSnackbarService.openSnackbar(config);
  }
}
