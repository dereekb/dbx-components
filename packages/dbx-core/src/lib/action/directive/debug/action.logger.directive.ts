import { Directive, inject } from '@angular/core';
import { cleanSubscription } from '../../../rxjs';
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
    cleanSubscription(
      this.source.state$.subscribe((state) => {
        console.log('dbxActionLogger - state: ', state);
      })
    );
  }
}
