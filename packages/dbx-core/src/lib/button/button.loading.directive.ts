import { Directive, effect, inject, input } from '@angular/core';
import { LoadingContext, MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { AbstractSubscriptionDirective } from '../subscription/subscription.directive';
import { DbxButton } from './button';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, shareReplay, Subscription } from 'rxjs';

/**
 * Context used for linking a button to a LoadingContext.
 *
 * It will be set working when the context is set loading.
 */
@Directive({
  selector: '[dbxLoadingButton]',
  standalone: true
})
export class DbxLoadingButtonDirective extends AbstractSubscriptionDirective {
  readonly dbxButton = inject(DbxButton, { host: true });
  readonly context = input.required<MaybeObservableOrValue<LoadingContext>>({ alias: 'dbxLoadingButton' });
  readonly context$ = toObservable(this.context).pipe(maybeValueFromObservableOrValue(), distinctUntilChanged(), shareReplay(1));
  readonly contextSignal = toSignal(this.context$);

  protected readonly _loadingEffect = effect(() => {
    const context = this.contextSignal();
    let subscription: Subscription | undefined;

    if (context) {
      subscription = context.stream$.subscribe((x) => this.dbxButton.setWorking(x.loading));
    }

    this.sub = subscription;
  });
}
