import { map, type Observable, combineLatest, firstValueFrom } from 'rxjs';
import { asObservable, filterMaybe, type ObservableOrValue } from '@dereekb/rxjs';
import { type DbxRouterService } from '../../service/router.service';
import { type DbxRouterTransitionService } from '../../service/router.transition.service';
import { asSegueRef, type SegueRef, type SegueRefOrSegueRefRouterLink, type SegueRefRawSegueParams } from '../../../segue';
import { type DbxRouterTransitionEvent, DbxRouterTransitionEventType } from '../../transition/transition';
import { ActivatedRoute, type NavigationBehaviorOptions, NavigationEnd, type NavigationExtras, NavigationStart, Router, type UrlTree } from '@angular/router';
import { Injectable, inject } from '@angular/core';
import { KeyValueTypleValueFilter, type Maybe, mergeObjects } from '@dereekb/util';

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

      if (Array.isArray(ref)) {
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
