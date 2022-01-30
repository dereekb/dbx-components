import { Subject } from 'rxjs';
import { DbxRouterService, DbxRouterTransitionService } from '../../service';
import { SegueRef } from "../../../segue";
import { StateService, UIRouterGlobals, TransitionOptions, TransitionService } from '@uirouter/core';
import { Injectable } from "@angular/core";
import { DbxRouterTransitionEvent, DbxRouterTransitionEventType } from '../../transition/transition';

/**
 * UIRouter implementation of DbxRouterService and DbxRouterTransitionService.
 */
@Injectable()
export class DbxUIRouterService implements DbxRouterService, DbxRouterTransitionService {

  private readonly _transitions = new Subject<DbxRouterTransitionEvent>();
  readonly transitions$ = this._transitions.asObservable();

  constructor(readonly state: StateService, readonly transitionService: TransitionService, readonly uiRouterGlobals: UIRouterGlobals) {

    const emitTransition = (type: DbxRouterTransitionEventType) => {
      this._transitions.next({
        type
      });
    }

    this.transitionService.onStart({}, () => {
      emitTransition(DbxRouterTransitionEventType.START);
    }) as any;

    this.transitionService.onSuccess({}, () => {
      emitTransition(DbxRouterTransitionEventType.SUCCESS);
    }) as any;

  }

  go(segueRef: SegueRef<TransitionOptions>): Promise<boolean> {
    const params = { ...this.uiRouterGlobals.current.params, ...segueRef.refParams };
    return this.state.go(segueRef.ref, params, segueRef.refOptions).then(_ => true).catch(_ => false);
  }

}
