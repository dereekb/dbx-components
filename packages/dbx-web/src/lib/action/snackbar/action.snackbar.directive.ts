import { Directive, Host, Input, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective, DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarEvent, DbxActionSnackbarType } from './action.snackbar';
import { DbxActionSnackbarService } from './action.snackbar.service';
import { DbxActionSnackbarDisplayConfigGeneratorFunction, DbxActionSnackbarGeneratorUndoInput } from './action.snackbar.generator';
import { LoadingState, loadingStateType } from '@dereekb/rxjs';

/**
 * Action directive that displays a snackbar when the action context hits a certain state.
 */
@Directive()
export class DbxActionSnackbarDirective<T = any, O = any> extends AbstractSubscriptionDirective implements OnInit {

  @Input('dbxActionSnackbar')
  snackbarFunction?: DbxActionSnackbarDisplayConfigGeneratorFunction<O>;

  @Input()
  snackbarDefault?: Maybe<DbxActionSnackbarType>;

  @Input()
  snackbarUndo?: DbxActionSnackbarGeneratorUndoInput;

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>,
    readonly dbxActionSnackbarService: DbxActionSnackbarService
  ) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.pipeStore((store) => store.loadingState$).subscribe((loadingState: LoadingState) => {
      const event: DbxActionSnackbarEvent = { value: loadingState.value, error: loadingState.error, type: loadingStateType(loadingState) };

      const config = this.buildConfigurationForEvent(event);

      if (config) {
        this.showSnackbarForConfiguration(config, event);
      }
    });
  }

  protected buildConfigurationForEvent(event: DbxActionSnackbarEvent): Maybe<DbxActionSnackbarDisplayConfig> {
    const input = {
      event,
      undo: this.snackbarUndo
    };

    return (this.snackbarFunction) ? this.snackbarFunction(input) : this.dbxActionSnackbarService.generateDisplayConfig(this.snackbarDefault, input);
  }

  protected showSnackbarForConfiguration(config: DbxActionSnackbarDisplayConfig, event: DbxActionSnackbarEvent) {
    this.dbxActionSnackbarService.openSnackbar(config);
  }

}
