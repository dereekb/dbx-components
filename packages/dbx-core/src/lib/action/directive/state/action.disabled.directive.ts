import { Directive, Host, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject, distinctUntilChanged } from 'rxjs';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

export const APP_ACTION_DISABLED_DIRECTIVE_KEY = 'dbx_action_disabled';

/**
 * Directive that allows disabling an action using the inputs.
 */
@Directive({
  selector: '[dbxActionDisabled]'
})
export class DbxActionDisabledDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  private readonly _disabled = new BehaviorSubject<boolean>(false);
  readonly disabled$ = this._disabled.pipe(distinctUntilChanged());

  ngOnInit(): void {
    this.sub = this.disabled$.subscribe((x) => {
      this.source.disable(APP_ACTION_DISABLED_DIRECTIVE_KEY, x);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._disabled.complete();
    this.source.enable(APP_ACTION_DISABLED_DIRECTIVE_KEY);
  }

  @Input('dbxActionDisabled')
  get disabled(): boolean {
    return this._disabled.value;
  }

  set disabled(disabled: Maybe<boolean | ''>) {
    this._disabled.next(disabled !== false);
  }
}
