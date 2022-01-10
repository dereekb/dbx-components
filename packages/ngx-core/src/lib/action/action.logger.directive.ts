import { Directive, OnInit, Host } from '@angular/core';
import { AbstractSubscriptionDirective } from '../subscription';
import { ActionContextStoreSourceInstance } from './action';

/**
 * Prints out the current state to the console. Useful for debugging.
 */
@Directive({
  selector: '[dbxActionContextLogger]'
})
export class DbNgxActionContextLoggerDirective extends AbstractSubscriptionDirective implements OnInit {

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.state$.subscribe((state) => {
      console.log('State: ', state);
    });
  }

}
