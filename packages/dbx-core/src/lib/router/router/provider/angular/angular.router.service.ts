import { Observable, combineLatest, firstValueFrom } from 'rxjs';
import { asObservable, filterMaybe, ObservableOrValue } from '@dereekb/rxjs';
import { DbxRouterService, DbxRouterTransitionService } from '../../service';
import { asSegueRef, SegueRef, SegueRefOrSegueRefRouterLink, SegueRefRawSegueParams } from '../../../segue';
import { DbxRouterTransitionEvent, DbxRouterTransitionEventType } from '../../transition/transition';
import { ActivatedRoute, NavigationBehaviorOptions, NavigationEnd, NavigationExtras, NavigationStart, Params, Router, UrlTree } from '@angular/router';
import { Injectable } from '@angular/core';
import { isArray } from 'class-validator';
import { map } from 'rxjs/operators';
import { KeyValueTypleValueFilter, Maybe, mergeObjects } from '@dereekb/util';

/**
 * AngularRouter implementation of DbxRouterService and DbxRouterTransitionService.
 */
@Injectable()
export class DbxAngularRouterService implements DbxRouterService, DbxRouterTransitionService {
  readonly params$: Observable<SegueRefRawSegueParams> = this.activatedRoute.params;

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

  constructor(readonly router: Router, readonly activatedRoute: ActivatedRoute) {}

  go(input: ObservableOrValue<SegueRefOrSegueRefRouterLink<NavigationExtras | NavigationBehaviorOptions>>): Promise<boolean> {
    const inputObs = asObservable(input);
    return firstValueFrom(inputObs).then((inputSegueRef) => {
      const segueRef = asSegueRef(inputSegueRef);
      const ref = segueRef.ref;

      if (isArray(ref)) {
        return this.router.navigate(ref as unknown[], {
          ...segueRef.refOptions,
          queryParams: segueRef.refParams
        });
      } else {
        return this.router.navigateByUrl(ref as string | UrlTree, {
          ...segueRef.refOptions
        });
      }
    });
  }

  updateParams(inputParams: ObservableOrValue<SegueRefRawSegueParams>): Promise<boolean> {
    const segueUpdate: Observable<SegueRefOrSegueRefRouterLink<NavigationExtras | NavigationBehaviorOptions>> = combineLatest([this.activatedRoute.params, asObservable(inputParams)]).pipe(
      map(([currentParams, params]) => {
        const refParams = mergeObjects([currentParams, params], KeyValueTypleValueFilter.UNDEFINED);
        const segueRef: SegueRef<NavigationExtras | NavigationBehaviorOptions> = {
          ref: this.activatedRoute.pathFromRoot,
          refParams,
          refOptions: {
            replaceUrl: true
          }
        };

        return segueRef;
      })
    );

    return this.go(segueUpdate);
  }

  isActive(segueRef: SegueRefOrSegueRefRouterLink): boolean {
    return false; // TODO!
  }

  comparePrecision(a: SegueRefOrSegueRefRouterLink, b: SegueRefOrSegueRefRouterLink): number {
    return 0; // TODO!
  }
}
