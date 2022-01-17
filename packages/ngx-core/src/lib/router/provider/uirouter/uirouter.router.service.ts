import { DbNgxRouterService } from "../../router.service";
import { SegueRef } from "../../segue";
import { StateService, UIRouterGlobals, TransitionOptions } from '@uirouter/core';
import { Injectable } from "@angular/core";

/**
 * UIRouter implementation of DbNgxRouterService
 */
@Injectable()
export class DbNgxUIRouterService implements DbNgxRouterService {

  constructor(readonly state: StateService, readonly uiRouterGlobals: UIRouterGlobals) { }

  go(segueRef: SegueRef<TransitionOptions>): Promise<boolean> {
    const params = { ...this.uiRouterGlobals.current.params, ...segueRef.refParams };
    return this.state.go(segueRef.ref, params, segueRef.refOptions).then(_ => true).catch(_ => false);
  }

}
