import { map, Observable, combineLatest, firstValueFrom } from 'rxjs';
import { asObservable, filterMaybe, ObservableOrValue } from '@dereekb/rxjs';
import { DbxRouterService } from '../../service/router.service';
import { DbxRouterTransitionService } from '../../service/router.transition.service';
import { asSegueRef, SegueRef, SegueRefOrSegueRefRouterLink, SegueRefRawSegueParams } from '../../../segue';
import { DbxRouterTransitionEvent, DbxRouterTransitionEventType } from '../../transition/transition';
import { ActivatedRoute, NavigationBehaviorOptions, NavigationEnd, NavigationExtras, NavigationStart, Router, UrlTree } from '@angular/router';
import { Injectable, inject } from '@angular/core';
import { isArray } from 'class-validator';
import { KeyValueTypleValueFilter, Maybe, mergeObjects } from '@dereekb/util';

/**
 * AngularRouter implementation of DbxRouterService and DbxRouterTransitionService.
 */
@Injectable()
export class DbxAngularRouterService implements DbxRouterService, DbxRouterTransitionService {
  readonly router = inject(Router);
  readonly activatedRoute = inject(ActivatedRoute);

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

  isActiveExactly(segueRef: SegueRefOrSegueRefRouterLink): boolean {
    return false; // TODO!
  }

  comparePrecision(a: SegueRefOrSegueRefRouterLink, b: SegueRefOrSegueRefRouterLink): number {
    return 0; // TODO!
  }
}
