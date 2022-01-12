import { Directive, Host, OnInit, OnDestroy, Input, NgZone } from '@angular/core';
import { ActionContextStoreSourceInstance } from '../action/action';
import { AbstractSubscriptionDirective } from '../subscription/subscription.directive';
import { DbNgxReadableErrorComponent } from './error.component';

/**
 * Context used for linking an ReadableErrorComponent to an ActionContext.
 */
@Directive({
  selector: '[dbNgxActionError]'
})
export class DbNgxActionErrorDirective extends AbstractSubscriptionDirective implements OnInit {

  constructor(@Host() public readonly error: DbNgxReadableErrorComponent, public readonly source: ActionContextStoreSourceInstance) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.error$.subscribe((error) => {
      this.error.error = error;
    });
  }

}
