import { DbxPopoverController } from './popover';
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { DbxPopoverCoordinatorService } from './popover.coordinator.service';
import { delay, map, shareReplay } from 'rxjs';

/**
 * Used for coordinating popovers and closing/replacing existing ones when a new popover of the same name appears.
 */
@Component({
  selector: 'dbx-popover-coordinator',
  template: `
    <ng-container *ngIf="show$ | async">
      <ng-content></ng-content>
    </ng-container>
  `
})
export class DbxPopoverCoordinatorComponent implements OnInit, OnDestroy {
  private readonly _service = inject(DbxPopoverCoordinatorService);
  private readonly _popover = inject(DbxPopoverController);

  readonly isPopoverForKey$ = this._service.popovers$.pipe(
    map((x) => x.get(this._popover.key) === this._popover),
    shareReplay(1)
  );
  readonly show$ = this.isPopoverForKey$.pipe(delay(0));

  constructor() {}

  ngOnInit(): void {
    this._service.addPopover(this._popover);
  }

  ngOnDestroy(): void {
    this._service.removePopover(this._popover.key, this._popover);
  }
}
