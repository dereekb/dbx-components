import { Directive, Input, inject } from '@angular/core';
import { LoadingContext } from '@dereekb/rxjs';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxErrorComponent } from './error.component';

/**
 * Context used for linking an ReadableErrorComponent to a LoadingContext.
 *
 * The error from the context is given to the app error when available.
 */
@Directive({
  selector: '[dbxLoadingError]',
  standalone: true
})
export class DbxLoadingErrorDirective extends AbstractSubscriptionDirective {
  readonly error = inject(DbxErrorComponent, { host: true });

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
