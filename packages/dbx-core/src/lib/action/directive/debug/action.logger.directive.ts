import { Directive, OnInit, inject } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Prints out the current state to the console. Useful for debugging.
 */
@Directive({
  selector: '[dbxActionLogger],[dbxActionContextLogger]',
  standalone: true
})
export class DbxActionContextLoggerDirective extends AbstractSubscriptionDirective implements OnInit {
  readonly source = inject(DbxActionContextStoreSourceInstance, { host: true });

  ngOnInit(): void {
    this.sub = this.source.state$.subscribe((state) => {
      console.log('dbxActionLogger - state: ', state);
    });
  }
}
