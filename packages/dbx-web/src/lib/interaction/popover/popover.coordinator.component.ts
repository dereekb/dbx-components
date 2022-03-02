import { DbNgxPopoverController } from './popover';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { DbNgxPopoverCoordinatorService } from './popover.coordinator.service';
import { delay, map, shareReplay } from 'rxjs/operators';

/**
 * Used for coordinating popovers and closing/replacing existing ones when a new popover of the same name appears.
 */
@Component({
  selector: 'dbx-popover-coordinator',
  template: `
  <ng-container *ngIf="show$ | async">
    <ng-content></ng-content>
  </ng-container>
  `,
  // TODO: styleUrls: ['./popover.scss']
})
export class DbNgxPopoverCoordinatorComponent implements OnInit, OnDestroy {

  readonly isPopoverForKey$ = this.service.popovers$.pipe(map(x => x.get(this.popover.key) === this.popover), shareReplay(1));
  readonly show$ = this.isPopoverForKey$.pipe(delay(0));

  constructor(private readonly service: DbNgxPopoverCoordinatorService, private readonly popover: DbNgxPopoverController) { }

  ngOnInit(): void {
    this.service.addPopover(this.popover);
  }

  ngOnDestroy(): void {
    this.service.removePopover(this.popover.key, this.popover);
  }

}
