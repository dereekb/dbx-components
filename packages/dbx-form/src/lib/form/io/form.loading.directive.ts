import { Observable, BehaviorSubject } from 'rxjs';
import { Directive, Host, Input, OnDestroy, inject } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxMutableForm } from '../../form/form';
import { LoadingState, isLoadingStateFinishedLoading } from '@dereekb/rxjs';
import { dbxFormSourceObservableFromStream, DbxFormSourceDirectiveMode } from './form.input.directive';

/**
 * Used with a FormComponent to set the value from a LoadingState when the value is available.
 */
@Directive({
  selector: '[dbxFormLoadingSource]'
})
export class DbxFormLoadingSourceDirective<T extends object = object> extends AbstractSubscriptionDirective implements OnDestroy {
  readonly form = inject(DbxMutableForm<T>, { host: true });

  private readonly _mode = new BehaviorSubject<DbxFormSourceDirectiveMode>('reset');

  @Input('dbxFormLoadingSourceMode')
  get mode(): DbxFormSourceDirectiveMode {
    return this._mode.value;
  }

  set mode(mode: DbxFormSourceDirectiveMode) {
    this._mode.next(mode);
  }

  /**
   * Sets a LoadingContext that is watched for the loading state.
   */
  @Input('dbxFormLoadingSource')
  set obs(obs: Observable<LoadingState<T>>) {
    this._setObs(obs);
  }

  private _setObs(inputObs: Observable<LoadingState<T>>): void {
    let subscription;

    if (inputObs) {
      subscription = dbxFormSourceObservableFromStream(this.form.stream$, inputObs, this._mode).subscribe((x) => {
        if (isLoadingStateFinishedLoading(x)) {
          this.form.setValue(x.value);
        }
      });
    }

    this.sub = subscription;
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._mode.complete();
  }
}
