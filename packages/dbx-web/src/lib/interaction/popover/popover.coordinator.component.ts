import { DbxPopoverController } from './popover';
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { DbxPopoverCoordinatorService } from './popover.coordinator.service';
import { delay, distinctUntilChanged, map, shareReplay } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Used for coordinating popovers and closing/replacing existing ones when a new popover of the same name appears.
 */
@Component({
  selector: 'dbx-popover-coordinator',
  template: `
    @if (showSignal()) {
      <ng-content></ng-content>
    }
  `,
  standalone: true
})
export class DbxPopoverCoordinatorComponent implements OnInit, OnDestroy {
  private readonly _service = inject(DbxPopoverCoordinatorService);
  private readonly _popover = inject(DbxPopoverController);

  readonly isPopoverForKey$ = this._service.popovers$.pipe(
    map((x) => x.get(this._popover.key) === this._popover),
    distinctUntilChanged(),
    shareReplay(1) // TODO: Unsure why this delay is here after all
  );

  readonly show$ = this.isPopoverForKey$.pipe(delay(0));
  readonly showSignal = toSignal(this.show$);

  ngOnInit(): void {
    this._service.addPopover(this._popover);
  }

  ngOnDestroy(): void {
    this._service.removePopover(this._popover.key, this._popover);
  }
}
