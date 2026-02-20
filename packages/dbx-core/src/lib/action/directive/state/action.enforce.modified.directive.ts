import { Directive, OnInit, OnDestroy, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { combineLatest, delay } from 'rxjs';
import { AbstractSubscriptionDirective } from '../../../rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

export const APP_ACTION_ENFORCE_MODIFIED_DIRECTIVE_KEY = 'dbx_action_enforce_modified';

/**
 * Directive that toggles disabling an action if the action is not marked modified.
 */
@Directive({
  selector: '[dbxActionEnforceModified]',
  standalone: true
})
export class DbxActionEnforceModifiedDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance, { host: true });

  readonly enabled = input<boolean, Maybe<boolean | ''>>(true, { alias: 'dbxActionEnforceModified', transform: (value) => value !== false });
  readonly enabled$ = toObservable(this.enabled);

  ngOnInit(): void {
    this.sub = combineLatest([this.source.isModified$, this.enabled$])
      .pipe(delay(0))
      .subscribe(([modified, enableDirective]) => {
        const disable = enableDirective && !modified;
        this.source.disable(APP_ACTION_ENFORCE_MODIFIED_DIRECTIVE_KEY, disable);
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.source.enable(APP_ACTION_ENFORCE_MODIFIED_DIRECTIVE_KEY);
  }
}
