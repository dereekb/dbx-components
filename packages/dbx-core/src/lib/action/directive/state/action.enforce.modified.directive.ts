import { Directive, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { combineLatest, delay } from 'rxjs';
import { clean, cleanSubscription } from '../../../rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Disabled key used by {@link DbxActionEnforceModifiedDirective} to track the
 * "not modified" disabled reason.
 */
export const APP_ACTION_ENFORCE_MODIFIED_DIRECTIVE_KEY = 'dbx_action_enforce_modified';

/**
 * Directive that disables the parent action when the action is not marked as modified.
 *
 * When enabled (default), this enforces that the user must make changes before the action
 * can be triggered. Once the action is marked as modified, the disabled key is removed.
 * This prevents no-op submissions where nothing has actually changed.
 *
 * Can be disabled by setting `dbxActionEnforceModified` to `false`.
 *
 * The disable key is automatically cleaned up on directive destruction.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container dbxActionEnforceModified></ng-container>
 *   <button (click)="action.trigger()">Save</button>
 * </div>
 * ```
 *
 * @see {@link DbxActionDisabledDirective} for general-purpose disabling.
 * @see {@link DbxActionAutoModifyDirective} for always keeping the action modified.
 */
@Directive({
  selector: '[dbxActionEnforceModified]',
  standalone: true
})
export class DbxActionEnforceModifiedDirective {
  readonly source = inject(DbxActionContextStoreSourceInstance, { host: true });

  readonly enabled = input<boolean, Maybe<boolean | ''>>(true, { alias: 'dbxActionEnforceModified', transform: (value) => value !== false });
  readonly enabled$ = toObservable(this.enabled);

  constructor() {
    cleanSubscription(
      combineLatest([this.source.isModified$, this.enabled$])
        .pipe(delay(0))
        .subscribe(([modified, enableDirective]) => {
          const disable = enableDirective && !modified;
          this.source.disable(APP_ACTION_ENFORCE_MODIFIED_DIRECTIVE_KEY, disable);
        })
    );

    clean(() => this.source.enable(APP_ACTION_ENFORCE_MODIFIED_DIRECTIVE_KEY));
  }
}
