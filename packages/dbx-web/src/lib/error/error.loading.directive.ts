import { Directive, effect, inject, input } from '@angular/core';
import { LoadingContext, MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxErrorComponent } from './error.component';
import { distinctUntilChanged, shareReplay, Subscription } from 'rxjs';
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
  readonly context = input.required<MaybeObservableOrValue<LoadingContext>>({ alias: 'dbxLoadingError' });
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
