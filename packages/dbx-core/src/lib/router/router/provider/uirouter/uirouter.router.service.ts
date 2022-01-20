import { Subject } from 'rxjs';
import { DbNgxRouterService, DbNgxRouterTransitionService } from '../../service';
import { SegueRef } from "../../../segue";
import { StateService, UIRouterGlobals, TransitionOptions, TransitionService } from '@uirouter/core';
import { Injectable } from "@angular/core";
import { DbNgxRouterTransitionEvent, DbNgxRouterTransitionEventType } from '../../transition/transition';

/**
 * UIRouter implementation of DbNgxRouterService and DbNgxRouterTransitionService.
 */
@Injectable()
export class DbNgxUIRouterService implements DbNgxRouterService, DbNgxRouterTransitionService {

  private readonly _transitions = new Subject<DbNgxRouterTransitionEvent>();
  readonly transitions$ = this._transitions.asObservable();

  constructor(readonly state: StateService, readonly transitionService: TransitionService, readonly uiRouterGlobals: UIRouterGlobals) {

    const emitTransition = (type: DbNgxRouterTransitionEventType) => {
      this._transitions.next({
        type
      });
    }

    this.transitionService.onStart({}, () => {
      emitTransition(DbNgxRouterTransitionEventType.START);
    }) as any;

    this.transitionService.onSuccess({}, () => {
      emitTransition(DbNgxRouterTransitionEventType.SUCCESS);
    }) as any;

  }

  go(segueRef: SegueRef<TransitionOptions>): Promise<boolean> {
    const params = { ...this.uiRouterGlobals.current.params, ...segueRef.refParams };
    return this.state.go(segueRef.ref, params, segueRef.refOptions).then(_ => true).catch(_ => false);
  }

}
