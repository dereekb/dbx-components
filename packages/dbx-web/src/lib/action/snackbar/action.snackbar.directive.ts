import { Directive, OnInit, inject, input } from '@angular/core';
import { AbstractSubscriptionDirective, DbxActionContextStoreSourceInstance, transformEmptyStringInputToUndefined } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarEvent, DbxActionSnackbarType } from './action.snackbar';
import { DbxActionSnackbarService } from './action.snackbar.service';
import { DbxActionSnackbarDisplayConfigGeneratorFunction, DbxActionSnackbarGeneratorInput, DbxActionSnackbarGeneratorUndoInput } from './action.snackbar.generator';
import { LoadingState, LoadingStateType, loadingStateType } from '@dereekb/rxjs';

/**
 * Action directive that displays a snackbar when the action context hits a certain state.
 */
@Directive({
  selector: '[dbxActionSnackbar]',
  standalone: true
})
export class DbxActionSnackbarDirective<T = unknown, O = unknown> extends AbstractSubscriptionDirective implements OnInit {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });
  readonly dbxActionSnackbarService = inject(DbxActionSnackbarService);

  readonly dbxActionSnackbarDefault = input<Maybe<DbxActionSnackbarType>>();
  readonly dbxActionSnackbarUndo = input<Maybe<DbxActionSnackbarGeneratorUndoInput<T, O>>>();
  readonly dbxActionSnackbar = input<Maybe<DbxActionSnackbarDisplayConfigGeneratorFunction>, Maybe<DbxActionSnackbarDisplayConfigGeneratorFunction> | ''>(undefined, { transform: transformEmptyStringInputToUndefined });

  ngOnInit(): void {
    this.sub = this.source
      .pipeStore((store) => store.loadingState$)
      .subscribe((loadingState: LoadingState<O>) => {
        const event: DbxActionSnackbarEvent<O> = { value: loadingState.value, error: loadingState.error, type: loadingStateType(loadingState) };

        const config = this.buildConfigurationForEvent(event);

        if (config) {
          this.showSnackbarForConfiguration(config, event);
        }
      });
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
