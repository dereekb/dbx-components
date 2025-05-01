import { Directive, OnDestroy, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

export const APP_ACTION_DISABLED_DIRECTIVE_KEY = 'dbx_action_disabled';

/**
 * Directive that allows disabling an action using the inputs.
 */
@Directive({
  selector: '[dbxActionDisabled]',
  standalone: true
})
export class DbxActionDisabledDirective<T, O> extends AbstractSubscriptionDirective implements OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly disabled = input<boolean, Maybe<boolean | ''>>(false, { alias: 'dbxActionDisabled', transform: (value) => value !== false });
  readonly disabled$ = toObservable(this.disabled);

  constructor() {
    super();
    this.sub = this.disabled$.subscribe((x) => {
      this.source.disable(APP_ACTION_DISABLED_DIRECTIVE_KEY, x);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.source.enable(APP_ACTION_DISABLED_DIRECTIVE_KEY);
  }
}
