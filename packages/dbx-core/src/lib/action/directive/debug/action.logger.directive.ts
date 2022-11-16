import { Directive, OnInit, Host } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Prints out the current state to the console. Useful for debugging.
 */
@Directive({
  selector: '[dbxActionLogger],[dbxActionContextLogger]'
})
export class DbxActionContextLoggerDirective extends AbstractSubscriptionDirective implements OnInit {
  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.state$.subscribe((state) => {
      console.log('dbxActionLogger - state: ', state);
    });
  }
}
