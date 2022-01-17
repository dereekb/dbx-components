import { DbNgxRouterService } from "../../router.service";
import { SegueRef } from "../../segue";
import { ActivatedRoute, NavigationBehaviorOptions, NavigationExtras, Router, UrlTree } from '@angular/router';
import { Injectable } from "@angular/core";
import { isArray } from "class-validator";

/**
 * AngularRouter implementation of DbNgxRouterService
 */
@Injectable()
export class DbNgxAngularRouterService implements DbNgxRouterService {

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
