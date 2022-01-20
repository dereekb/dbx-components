import { Directive, Host, Input } from '@angular/core';
import { LoadingContext } from '@dereekb/util-rxjs';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbNgxReadableErrorComponent } from './error.component';

/**
 * Context used for linking an ReadableErrorComponent to a LoadingContext.
 *
 * The error from the context is given to the app error when available.
 */
@Directive({
  selector: '[dbxLoadingError]'
})
export class DbNgxLoadingErrorDirective extends AbstractSubscriptionDirective {

  constructor(@Host() public readonly error: DbNgxReadableErrorComponent) {
    super();
  }

  /**
   * Sets a LoadingContext that is watched for the loading state.
   */
  @Input('dbxLoadingError')
  set context(context: LoadingContext) {
    let subscription;

    if (context) {
      subscription = context.stream$.subscribe((x) => {
        this.error.error = x.error;
      });
    }

    this.sub = subscription;
  }

}
