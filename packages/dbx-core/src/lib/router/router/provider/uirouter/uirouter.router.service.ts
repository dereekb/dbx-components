import { KeyValueTypleValueFilter, mergeObjects } from '@dereekb/util';
import { Subject, BehaviorSubject, Observable, firstValueFrom, map, filter } from 'rxjs';
import { DbxRouterService, DbxRouterTransitionService, onRouterTransitionSuccessEvent } from '../../service';
import { asSegueRef, asSegueRefString, SegueRef, SegueRefOrSegueRefRouterLink, SegueRefRawSegueParams } from '../../../segue';
import { StateService, UIRouterGlobals, TransitionOptions, TransitionService } from '@uirouter/core';
import { Injectable, OnDestroy } from '@angular/core';
import { DbxRouterTransitionEvent, DbxRouterTransitionEventType } from '../../transition/transition';
import { ObservableOrValue, asObservable } from '@dereekb/rxjs';

/**
 * UIRouter implementation of DbxRouterService and DbxRouterTransitionService.
 */
@Injectable()
export class DbxUIRouterService implements DbxRouterService, DbxRouterTransitionService, OnDestroy {
  private readonly _params = new BehaviorSubject<SegueRefRawSegueParams>(this.uiRouterGlobals.params);
  readonly params$ = this._params.asObservable();

  private readonly _transitions = new Subject<DbxRouterTransitionEvent>();
  readonly transitions$ = this._transitions.asObservable();

  constructor(readonly state: StateService, readonly transitionService: TransitionService, readonly uiRouterGlobals: UIRouterGlobals) {
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

    const targetRef = ref.startsWith('.') ? `^${ref}` : ref;
    const active = exactly ? this.state.is(targetRef, refParams) : this.state.includes(targetRef, refParams);
    return active;
  }
}
