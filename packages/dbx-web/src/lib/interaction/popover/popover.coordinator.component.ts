import { DbxPopoverController } from './popover';
import { Component, inject } from '@angular/core';
import { DbxPopoverCoordinatorService } from './popover.coordinator.service';
import { delay, distinctUntilChanged, map, shareReplay } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { clean } from '@dereekb/dbx-core';

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
export class DbxPopoverCoordinatorComponent {
  private readonly _service = inject(DbxPopoverCoordinatorService);
  private readonly _popover = inject(DbxPopoverController);

  readonly isPopoverForKey$ = this._service.popovers$.pipe(
    map((x) => x.get(this._popover.key) === this._popover),
    distinctUntilChanged(),
    shareReplay(1) // TODO: Unsure why this delay is here after all
  );

  readonly show$ = this.isPopoverForKey$.pipe(delay(0));
  readonly showSignal = toSignal(this.show$);

  constructor() {
    this._service.addPopover(this._popover);
    clean(() => this._service.removePopover(this._popover.key, this._popover));
  }
}
