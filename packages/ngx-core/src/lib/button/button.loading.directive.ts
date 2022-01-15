import { Directive, Host, Input, NgZone } from '@angular/core';
import { LoadingContext } from '../loading/loading';
import { AbstractSubscriptionDirective } from '../subscription';
import { DbNgxButtonDirective } from './button.directive';

/**
 * Context used for linking a button to a LoadingContext.
 *
 * It will be set working when the context is set loading.
 */
@Directive({
  selector: '[dbxLoadingButton]'
})
export class DbNgxLoadingButtonDirective extends AbstractSubscriptionDirective {

  constructor(@Host() public readonly button: DbNgxButtonDirective, readonly ngZone: NgZone) {
    super();
  }

  /**
   * Sets a LoadingContext that is watched for the loading state.
   */
  @Input('dbxLoadingButton')
  set context(context: LoadingContext) {
    let subscription;

    if (context) {
      subscription = context.stream$.subscribe((x) => {
        this.ngZone.run(() => this.button.working = x.loading);
      });
    }

    this.sub = subscription;
  }

}
