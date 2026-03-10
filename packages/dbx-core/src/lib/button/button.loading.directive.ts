import { Directive, effect, inject, input } from '@angular/core';
import { type LoadingContext, type MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { DbxButton } from './button';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, shareReplay, type Subscription } from 'rxjs';
import { cleanSubscription } from '../rxjs/subscription';

/**
 * Links a {@link DbxButton} to a {@link LoadingContext}, automatically setting the button
 * to a working state whenever the loading context is actively loading.
 *
 * @example
 * ```html
 * <button dbxButton [dbxLoadingButton]="loadingContext">
 *   Loading...
 * </button>
 * ```
 *
 * @example
 * ```typescript
 * readonly loadingContext = cleanLoadingContext<MyData>(this.data$);
 * ```
 */
@Directive({
  selector: '[dbxLoadingButton]',
  standalone: true
})
export class DbxLoadingButtonDirective {
  readonly dbxButton = inject(DbxButton, { host: true });
  readonly context = input.required<MaybeObservableOrValue<LoadingContext>>({ alias: 'dbxLoadingButton' });
  readonly context$ = toObservable(this.context).pipe(maybeValueFromObservableOrValue(), distinctUntilChanged(), shareReplay(1));
  readonly contextSignal = toSignal(this.context$);

  protected readonly _loadingEffectSub = cleanSubscription();
  protected readonly _loadingEffect = effect(() => {
    const context = this.contextSignal();
    let subscription: Subscription | undefined;

    if (context) {
      subscription = context.stream$.subscribe((x) => this.dbxButton.setWorking(x.loading));
    }

    this._loadingEffectSub.setSub(subscription);
  });
}
