import { Directive, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, combineLatest, delay } from 'rxjs';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

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

  private readonly _enabled = new BehaviorSubject<boolean>(true);

  ngOnInit(): void {
    this.sub = combineLatest([this.source.isModified$, this._enabled])
      .pipe(delay(0))
      .subscribe(([modified, enableDirective]) => {
        const disable = enableDirective && !modified;
        this.source.disable(APP_ACTION_ENFORCE_MODIFIED_DIRECTIVE_KEY, disable);
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._enabled.complete();
    this.source.enable(APP_ACTION_ENFORCE_MODIFIED_DIRECTIVE_KEY);
  }

  @Input('dbxActionEnforceModified')
  get enabled(): boolean {
    return this._enabled.value;
  }

  set enabled(enabled: Maybe<boolean | ''>) {
    this._enabled.next(enabled !== false);
  }
}
