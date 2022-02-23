import { filterMaybe } from '@dereekb/rxjs';
import { DbxRouterService, DbxRouterTransitionService } from '../../service';
import { SegueRef } from "../../../segue";
import { DbxRouterTransitionEvent, DbxRouterTransitionEventType } from "../../transition/transition";
import { ActivatedRoute, NavigationBehaviorOptions, NavigationEnd, NavigationExtras, NavigationStart, Router } from '@angular/router';
import { Injectable } from "@angular/core";
import { isArray } from "class-validator";
import { map } from "rxjs/operators";
import { Maybe } from '@dereekb/util';

/**
 * AngularRouter implementation of DbxRouterService and DbxRouterTransitionService.
 */
@Injectable()
export class DbxAngularRouterService implements DbxRouterService, DbxRouterTransitionService {

  readonly transitions$ = this.router.events.pipe(
    map((x) => {
      let event: Maybe<DbxRouterTransitionEvent>;

      if (x instanceof NavigationStart) {
        event = {
          type: DbxRouterTransitionEventType.START
        };
      } else if (x instanceof NavigationEnd) {
        event = {
          type: DbxRouterTransitionEventType.SUCCESS
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

  isActive(segueRef: SegueRef<any>): boolean {
    return false; // TODO!
  }

  comparePrecision(a: SegueRef, b: SegueRef): number {
    return 0;   // TODO!
  }

}
