import { Injectable, type Provider } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { type Maybe } from '@dereekb/util';
import { distinctUntilChanged, map } from 'rxjs';
import { type DbxFirebaseLoginPrefill } from './login.prefill';

/**
 * State shape for the login prefill context store.
 */
export interface DbxFirebaseLoginPrefillState {
  /**
   * The prefill to present, or undefined when there is none to present.
   */
  readonly prefill: Maybe<DbxFirebaseLoginPrefill>;
  /**
   * Whether the matching provider should open its login view on its own to present the prefill.
   */
  readonly autoOpen: boolean;
  /**
   * Whether a provider has already opened its login view for the current prefill.
   */
  readonly opened: boolean;
}

const INITIAL_STATE: DbxFirebaseLoginPrefillState = {
  prefill: undefined,
  autoOpen: true,
  opened: false
};

/**
 * NgRx ComponentStore that carries the {@link DbxFirebaseLoginPrefill} for a single login view.
 *
 * Provided via {@link DbxFirebaseLoginPrefillDirective}, which fills it from the current route. The provider buttons
 * rendered underneath resolve it through the element injector and read it to seed their form.
 */
@Injectable()
export class DbxFirebaseLoginPrefillStore extends ComponentStore<DbxFirebaseLoginPrefillState> {
  constructor() {
    super({ ...INITIAL_STATE });
  }

  // MARK: Accessors
  /**
   * Pipes the current prefill.
   */
  readonly prefill$ = this.state$.pipe(
    map((x) => x.prefill),
    distinctUntilChanged()
  );

  /**
   * Pipes whether a provider should open its login view now in order to present the current prefill.
   *
   * Goes false for good once {@link markOpened} is called, so cancelling back out to the login list does not
   * immediately re-open the view the user just left.
   */
  readonly shouldOpenPrefill$ = this.state$.pipe(
    map((x) => x.prefill != null && x.autoOpen && !x.opened),
    distinctUntilChanged()
  );

  // MARK: State Changes
  readonly setPrefill = this.updater((state, prefill: Maybe<DbxFirebaseLoginPrefill>) => ({ ...state, prefill }));

  readonly setAutoOpen = this.updater((state, autoOpen: boolean) => ({ ...state, autoOpen }));

  readonly markOpened = this.updater((state) => ({ ...state, opened: true }));
}

/**
 * Creates the providers for a {@link DbxFirebaseLoginPrefillStore}.
 *
 * @returns Providers for the store.
 */
export function provideDbxFirebaseLoginPrefill(): Provider[] {
  return [
    {
      provide: DbxFirebaseLoginPrefillStore,
      useClass: DbxFirebaseLoginPrefillStore
    }
  ];
}
