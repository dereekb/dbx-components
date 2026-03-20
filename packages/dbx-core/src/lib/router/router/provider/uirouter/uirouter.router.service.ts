import { KeyValueTypleValueFilter, mergeObjects } from '@dereekb/util';
import { Subject, BehaviorSubject, type Observable, firstValueFrom, map } from 'rxjs';
import { type DbxRouterService } from '../../service/router.service';
import { type DbxRouterTransitionService } from '../../service/router.transition.service';
import { asSegueRef, asSegueRefString, type SegueRef, type SegueRefOrSegueRefRouterLink, type SegueRefRawSegueParams } from '../../../segue';
import { StateService, UIRouter, UIRouterGlobals, type TransitionOptions, TransitionService } from '@uirouter/core';
import { Injectable, type OnDestroy, inject } from '@angular/core';
import { type DbxRouterTransitionEvent, DbxRouterTransitionEventType } from '../../transition/transition';
import { type ObservableOrValue, asObservable } from '@dereekb/rxjs';

/**
 * UIRouter implementation of {@link DbxRouterService} and {@link DbxRouterTransitionService}.
 *
 * Bridges UIRouter's `TransitionService` events to {@link DbxRouterTransitionEvent} values and provides
 * navigation via UIRouter's `StateService.go()`. Supports state activity checks and route precision comparison.
 *
 * @example
 * ```ts
 * // Register via the provider function
 * provideDbxUIRouterService()
 *
 * // Or inject and use
 * const router = inject(DbxRouterService);
 * await router.go({ ref: 'app.dashboard', refParams: { id: '123' } });
 * ```
 *
 * @see {@link DbxRouterService}
 * @see {@link provideDbxUIRouterService} for provider registration
 * @see {@link DbxAngularRouterService} for the Angular Router alternative
 */
@Injectable()
export class DbxUIRouterService implements DbxRouterService, DbxRouterTransitionService, OnDestroy {
  readonly uiRouter = inject(UIRouter);
  readonly state = inject(StateService);
  readonly transitionService = inject(TransitionService);
  readonly uiRouterGlobals = inject(UIRouterGlobals);

  private readonly _params = new BehaviorSubject<SegueRefRawSegueParams>(this.uiRouterGlobals.params);

  readonly params$ = this._params.asObservable();

  private readonly _transitions = new Subject<DbxRouterTransitionEvent>();
  readonly transitions$ = this._transitions.asObservable();

  constructor() {
    const emitTransition = (type: DbxRouterTransitionEventType) => {
      this._transitions.next({
        type
      });

      this._params.next(this.uiRouterGlobals.params);
    };

    this.transitionService.onStart({}, () => {
      emitTransition(DbxRouterTransitionEventType.START);
    });

    this.transitionService.onSuccess({}, () => {
      emitTransition(DbxRouterTransitionEventType.SUCCESS);
    });
  }

  ngOnDestroy(): void {
    this._transitions.complete();
  }

  get params() {
    return this.uiRouterGlobals.params;
  }

  go(input: ObservableOrValue<SegueRefOrSegueRefRouterLink<TransitionOptions>>): Promise<boolean> {
    const inputObs = asObservable(input);
    return firstValueFrom(inputObs).then((inputSegueRef) => {
      const segueRef = asSegueRef(inputSegueRef);
      const params = { ...this.uiRouterGlobals.current.params, ...segueRef.refParams };
      return this.state
        .go(segueRef.ref as string, params, segueRef.refOptions)
        .then(() => true)
        .catch(() => false);
    });
  }

  updateParams(inputParams: ObservableOrValue<SegueRefRawSegueParams>): Promise<boolean> {
    const segueUpdate: Observable<SegueRefOrSegueRefRouterLink<TransitionOptions>> = asObservable(inputParams).pipe(
      map((params) => {
        const currentParams = this.uiRouterGlobals.params;
        const refParams = mergeObjects([currentParams, params], KeyValueTypleValueFilter.UNDEFINED);

        const ref: SegueRef<TransitionOptions> = {
          ref: '.',
          refParams,
          refOptions: {
            location: 'replace',
            inherit: true
          }
        };

        return ref;
      })
    );

    return this.go(segueUpdate);
  }

  isActive(input: SegueRefOrSegueRefRouterLink): boolean {
    return this.isActiveState(input, false);
  }

  isActiveExactly(input: SegueRefOrSegueRefRouterLink): boolean {
    return this.isActiveState(input, true);
  }

  comparePrecision(aInput: SegueRefOrSegueRefRouterLink, bInput: SegueRefOrSegueRefRouterLink): number {
    const aRef = asSegueRefString(aInput);
    const bRef = asSegueRefString(bInput);

    const aLength = aRef.length;
    const bLength = bRef.length;
    return aLength > bLength ? 1 : aLength === bLength ? 0 : -1;
  }

  // MARK: Internal
  isActiveState(input: SegueRefOrSegueRefRouterLink, exactly: boolean): boolean {
    const segueRef = asSegueRef(input);
    const ref = segueRef.ref as string;
    const refParams = segueRef.refParams;

    // Slash paths (e.g., '/demo/oauth') are compared against the current URL path
    if (ref.startsWith('/')) {
      const currentPath = this.uiRouter.urlService.path();

      if (exactly) {
        return currentPath === ref;
      } else {
        return currentPath === ref || currentPath.startsWith(ref + '/');
      }
    }

    const targetRef = ref.startsWith('.') ? `^${ref}` : ref;
    return exactly ? this.state.is(targetRef, refParams) : this.state.includes(targetRef, refParams);
  }
}
