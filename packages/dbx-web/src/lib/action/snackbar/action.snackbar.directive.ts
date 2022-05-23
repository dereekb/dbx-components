import { Directive, Host, Input, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective, DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarEvent, DbxActionSnackbarType } from './action.snackbar';
import { DbxActionSnackbarService } from './action.snackbar.service';
import { DbxActionSnackbarDisplayConfigGeneratorFunction, DbxActionSnackbarGeneratorInput, DbxActionSnackbarGeneratorUndoInput } from './action.snackbar.generator';
import { LoadingState, LoadingStateType, loadingStateType } from '@dereekb/rxjs';

/**
 * Action directive that displays a snackbar when the action context hits a certain state.
 */
@Directive({
  selector: '[dbxActionSnackbar]'
})
export class DbxActionSnackbarDirective<T = unknown, O = unknown> extends AbstractSubscriptionDirective implements OnInit {

  private _snackbarFunction?: Maybe<DbxActionSnackbarDisplayConfigGeneratorFunction<O>>;

  @Input('dbxActionSnackbar')
  get snackbarFunction(): Maybe<DbxActionSnackbarDisplayConfigGeneratorFunction<O>> {
    return this._snackbarFunction;
  }

  set snackbarFunction(snackbarFunction: Maybe<'' | DbxActionSnackbarDisplayConfigGeneratorFunction<O>>) {
    if (snackbarFunction) {
      this._snackbarFunction = snackbarFunction;
    }
  }

  @Input()
  dbxActionSnackbarDefault?: Maybe<DbxActionSnackbarType>;

  @Input()
  dbxActionSnackbarUndo?: DbxActionSnackbarGeneratorUndoInput;

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>,
    readonly dbxActionSnackbarService: DbxActionSnackbarService
  ) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.pipeStore((store) => store.loadingState$).subscribe((loadingState: LoadingState<O>) => {
      const event: DbxActionSnackbarEvent<O> = { value: loadingState.value, error: loadingState.error, type: loadingStateType(loadingState) };

      const config = this.buildConfigurationForEvent(event);

      if (config) {
        this.showSnackbarForConfiguration(config, event);
      }
    });
  }

  protected buildConfigurationForEvent(event: DbxActionSnackbarEvent<O>): Maybe<DbxActionSnackbarDisplayConfig> {
    const input: DbxActionSnackbarGeneratorInput<O> = {
      event,
      undo: event.type === LoadingStateType.SUCCESS ? this.dbxActionSnackbarUndo : undefined  // only show undo on success.
    };

    return (this.snackbarFunction) ? this.snackbarFunction(input) : this.dbxActionSnackbarService.generateDisplayConfig(this.dbxActionSnackbarDefault, input);
  }

  protected showSnackbarForConfiguration(config: DbxActionSnackbarDisplayConfig, event: DbxActionSnackbarEvent) {
    this.dbxActionSnackbarService.openSnackbar(config);
  }

}
