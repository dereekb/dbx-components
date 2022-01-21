import { Component } from '@angular/core';
import { ActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Displays the input content when working is set.
 */
@Component({
  selector: 'dbx-action-working',
  template: `
    <ng-container *ngIf="show$ | async">
      <ng-content></ng-content>
    </ng-container>
  `
})
export class DbNgxActionWorkingComponent {

  readonly show$ = this.source.isWorking$;

  constructor(public readonly source: ActionContextStoreSourceInstance) { }

}
