import { Directive, inject } from '@angular/core';
import { cleanSubscriptionWithLockSet } from '../../../rxjs/lockset';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Debug directive that logs every action context state change to the console.
 *
 * Subscribes to the parent action's full state stream and prints each state snapshot
 * via `console.log`. Useful during development to inspect the action lifecycle transitions.
 *
 * @dbxAction
 * @dbxActionSlug logger
 * @dbxActionStateInteraction IDLE, TRIGGERED, VALUE_READY, WORKING, RESOLVED, REJECTED, DISABLED
 * @dbxActionConsumesContext
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container dbxActionLogger></ng-container>
 *   <!-- other action directives -->
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxActionLogger],[dbxActionContextLogger]',
  standalone: true
})
export class DbxActionContextLoggerDirective {
  readonly source = inject(DbxActionContextStoreSourceInstance, { host: true });

  constructor() {
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.source.state$.subscribe((state) => {
        console.log('dbxActionLogger - state: ', state);
      })
    });
  }
}
