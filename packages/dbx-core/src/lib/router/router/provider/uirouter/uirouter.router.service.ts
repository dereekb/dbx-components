import { Subject, BehaviorSubject } from 'rxjs';
import { DbxRouterService, DbxRouterTransitionService } from '../../service';
import { asSegueRef, SegueRef, SegueRefOrSegueRefRouterLink, SegueRefRawSegueParams } from "../../../segue";
import { StateService, UIRouterGlobals, TransitionOptions, TransitionService } from '@uirouter/core';
import { Injectable, OnDestroy } from "@angular/core";
import { DbxRouterTransitionEvent, DbxRouterTransitionEventType } from '../../transition/transition';
import { Maybe } from '@dereekb/util';

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
    }

    this.transitionService.onStart({}, () => {
      emitTransition(DbxRouterTransitionEventType.START);
    }) as any;

    this.transitionService.onSuccess({}, () => {
      emitTransition(DbxRouterTransitionEventType.SUCCESS);
    }) as any;

  }

  ngOnDestroy(): void {
    this._transitions.complete();
  }

  get params() {
    return this.uiRouterGlobals.params;
  }

  go(input: SegueRefOrSegueRefRouterLink<TransitionOptions>): Promise<boolean> {
    const segueRef = asSegueRef(input);
    const params = { ...this.uiRouterGlobals.current.params, ...segueRef.refParams };
    return this.state.go(segueRef.ref, params, segueRef.refOptions).then(_ => true).catch(_ => false);
  }

  isActive(input: SegueRefOrSegueRefRouterLink): boolean {
    const segueRef = asSegueRef(input);
    const { ref, refParams } = segueRef;

    const targetRef = (ref.startsWith('.') ? `^${ref}` : ref);
    const active = this.state.includes(targetRef, refParams);
    return active;
  }

  comparePrecision(aInput: SegueRefOrSegueRefRouterLink, bInput: SegueRefOrSegueRefRouterLink): number {
    const aRef = readSegueRefString(aInput);
    const bRef = readSegueRefString(bInput);

    const aLength = aRef.length;
    const bLength = bRef.length;
    return (aLength > bLength) ? 1 : (aLength === bLength) ? 0 : -1;
  }

}

export function readSegueRefString(input: SegueRefOrSegueRefRouterLink | string): string {
  if (typeof input === 'string') {
    return input;
  } else {
    return input?.ref ?? '';
  }
}
