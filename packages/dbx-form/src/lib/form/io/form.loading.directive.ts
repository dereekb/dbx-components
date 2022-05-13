import { Observable, BehaviorSubject } from 'rxjs';
import { Directive, Host, Input, OnDestroy } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxMutableForm } from '../../form/form';
import { LoadingState, loadingStateHasFinishedLoading } from '@dereekb/rxjs';
import { DbxFormSourceDirectiveMode, dbxFormSourceObservable } from './form.input.directive';

/**
 * Used with a FormComponent to set the value from a LoadingState when the value is available.
 */
@Directive({
  selector: '[dbxFormLoadingSource]'
})
export class DbxFormLoadingSourceDirective<T extends object = any> extends AbstractSubscriptionDirective implements OnDestroy {

  private _mode = new BehaviorSubject<DbxFormSourceDirectiveMode>('reset');

  constructor(@Host() public readonly form: DbxMutableForm) {
    super();
  }

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
      subscription = dbxFormSourceObservable(this.form, inputObs, this._mode).subscribe((x) => {
        if (loadingStateHasFinishedLoading(x)) {
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
