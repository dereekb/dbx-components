import { Component, Input, OnInit } from '@angular/core';
import { interval } from 'rxjs';
import { of } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { delay, delayWhen, exhaustMap, filter, mergeMap, shareReplay, startWith } from 'rxjs/operators';
import { AbstractSubscriptionDirective } from '../subscription';
import { ActionContextStoreSourceInstance } from './action';
import { ActionContextStore } from './action.store';

/**
 * Displays the input content when success is set.
 *
 * Can be configured to show for a limited time afterwards, etc.
 */
@Component({
  selector: 'dbx-action-success',
  template: `
    <ng-container *ngIf="show$ | async">
      <ng-content></ng-content>
    </ng-container>
  `
})
export class DbNgxActionSuccessComponent {

  @Input()
  hideAfter?: number;

  readonly show$ = this.source.isSuccess$.pipe(
    exhaustMap((success) => {
      if (success) {
        if (this.hideAfter) {
          return of(false).pipe(
            delay(this.hideAfter),
            startWith(true)
          );
        } else {
          return of(true);
        }
      } else {
        return of(false);
      }
    }),
    shareReplay(1)
  );

  constructor(public readonly source: ActionContextStoreSourceInstance) { }

}
