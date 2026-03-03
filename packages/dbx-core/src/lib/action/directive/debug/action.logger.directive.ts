import { Directive, inject } from '@angular/core';
import { cleanSubscriptionWithLockSet } from '../../../rxjs/lockset';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Prints out the current state to the console. Useful for debugging.
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
