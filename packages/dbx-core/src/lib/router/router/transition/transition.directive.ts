import { Observable, startWith } from 'rxjs';
import { Directive } from '@angular/core';
import { DbxRouterTransitionService } from '../service/router.transition.service';
import { successTransition } from './transition.rxjs';

/**
 * Abstract directive that listens to onSuccess transition events and runs a function.
 */
@Directive()
export abstract class AbstractTransitionDirective {

  readonly transitionSuccess$ = successTransition(this.dbxRouterTransitionService.transitions$);
  readonly initAndUpdateOnTransitionSuccess$: Observable<void> = this.transitionSuccess$.pipe(startWith(undefined)) as Observable<void>;

  constructor(protected readonly dbxRouterTransitionService: DbxRouterTransitionService) { }

}
