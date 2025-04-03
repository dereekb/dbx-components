import { ObservableOrValue } from './../../../../../.nx/cache/14608316092629526125/outputs/dist/packages/rxjs/src/lib/rxjs/getter.d';
import { Directive, Input, effect, inject, input } from '@angular/core';
import { LoadingContext, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxErrorComponent } from './error.component';
import { distinctUntilChanged, shareReplay, Subscription } from 'rxjs';
import { Maybe } from '@dereekb/util';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

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
  readonly context = input.required<Maybe<ObservableOrValue<LoadingContext>>>({ alias: 'dbxLoadingError' });
  readonly context$ = toObservable(this.context).pipe(maybeValueFromObservableOrValue(), distinctUntilChanged(), shareReplay(1));
  readonly contextSignal = toSignal(this.context$);

  protected readonly _errorEffect = effect(() => {
    const context = this.contextSignal();
    let subscription: Subscription | undefined;

    if (context) {
      subscription = context.stream$.subscribe((x) => this.error.setError(x.error));
    }

    this.sub = subscription;
  });
}
