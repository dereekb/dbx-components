import { filterMaybe } from '@dereekb/util-rxjs';
import { DbNgxRouterService, DbNgxRouterTransitionService } from '../../service';
import { SegueRef } from "../../../segue";
import { ActivatedRoute, NavigationBehaviorOptions, NavigationEnd, NavigationExtras, NavigationStart, Router } from '@angular/router';
import { Injectable } from "@angular/core";
import { isArray } from "class-validator";
import { DbNgxRouterTransitionEvent, DbNgxRouterTransitionEventType } from "../../transition/transition";
import { map } from "rxjs/operators";
import { Maybe } from '@dereekb/util';

/**
 * AngularRouter implementation of DbNgxRouterService and DbNgxRouterTransitionService.
 */
@Injectable()
export class DbNgxAngularRouterService implements DbNgxRouterService, DbNgxRouterTransitionService {

  readonly transitions$ = this.router.events.pipe(
    map((x) => {
      let event: Maybe<DbNgxRouterTransitionEvent>;

      if (x instanceof NavigationStart) {
        event = {
          type: DbNgxRouterTransitionEventType.START
        };
      } else if (x instanceof NavigationEnd) {
        event = {
          type: DbNgxRouterTransitionEventType.SUCCESS
        };
      }

      return event;
    }),
    filterMaybe()
  );

  constructor(readonly router: Router, readonly activatedRoute: ActivatedRoute) { }

  go(segueRef: SegueRef<NavigationExtras | NavigationBehaviorOptions>): Promise<boolean> {
    let ref = segueRef.ref;

    if (isArray(ref)) {
      return this.router.navigate(ref, {
        ...segueRef.refOptions,
        queryParams: segueRef.refParams
      })
    } else {
      return this.router.navigateByUrl(ref, {
        ...segueRef.refOptions
      });
    }
  }

}
