import { Directive, effect, inject, input } from '@angular/core';
import { type LoadingContext, type MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { cleanSubscription } from '@dereekb/dbx-core';
import { DbxErrorComponent } from './error.component';
import { distinctUntilChanged, shareReplay, type Subscription } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

/**
 * Links a {@link DbxErrorComponent} to a {@link LoadingContext}, automatically displaying loading errors.
 *
 * Subscribes to the loading context's stream and forwards any errors to the host `<dbx-error>` component.
 * Accepts a `LoadingContext` directly or an `Observable<LoadingContext>`.
 *
 * @example
 * ```html
 * <dbx-error [dbxLoadingError]="loadingContext"></dbx-error>
 *
 * <dbx-error [dbxLoadingError]="loadingContext$"></dbx-error>
 * ```
 */
@Directive({
  selector: '[dbxLoadingError]',
  standalone: true
})
export class DbxLoadingErrorDirective {
  readonly error = inject(DbxErrorComponent, { host: true });

  readonly context = input.required<MaybeObservableOrValue<LoadingContext>>({ alias: 'dbxLoadingError' });

  readonly context$ = toObservable(this.context).pipe(maybeValueFromObservableOrValue(), distinctUntilChanged(), shareReplay(1));
  readonly contextSignal = toSignal(this.context$);

  protected readonly _errorEffectSub = cleanSubscription();
  protected readonly _errorEffect = effect(() => {
    const context = this.contextSignal();
    let subscription: Subscription | undefined;

    if (context) {
      subscription = context.stream$.subscribe((x) => this.error.setError(x.error));
    }

    this._errorEffectSub.setSub(subscription);
  });
}
