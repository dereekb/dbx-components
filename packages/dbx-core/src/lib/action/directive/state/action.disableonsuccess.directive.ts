import { Directive, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, distinctUntilChanged, combineLatest } from 'rxjs';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

export const APP_ACTION_DISABLED_ON_SUCCESS_DIRECTIVE_KEY = 'dbx_action_disabled_on_success';

/**
 * Directive that will disable the action after the action completes successfully.
 */
@Directive({
  selector: '[dbxActionDisabledOnSuccess]',
  standalone: true
})
export class DbxActionDisabledOnSuccessDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  private readonly _disableOnSuccess = new BehaviorSubject<boolean>(true);
  readonly disableOnSuccess$ = this._disableOnSuccess.pipe(distinctUntilChanged());

  ngOnInit(): void {
    this.sub = combineLatest([this.disableOnSuccess$, this.source.isSuccess$]).subscribe(([disableOnSuccess, success]) => {
      this.source.disable(APP_ACTION_DISABLED_ON_SUCCESS_DIRECTIVE_KEY, disableOnSuccess && success);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._disableOnSuccess.complete();
    this.source.enable(APP_ACTION_DISABLED_ON_SUCCESS_DIRECTIVE_KEY);
  }

  @Input('dbxActionDisabledOnSuccess')
  get disabled(): boolean {
    return this._disableOnSuccess.value;
  }

  set disabled(disabled: Maybe<boolean | ''>) {
    this._disableOnSuccess.next(disabled !== false);
  }
}
