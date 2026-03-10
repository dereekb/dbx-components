import { DbxPopupController } from './popup';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxPopupCoordinatorService } from './popup.coordinator.service';
import { delay, map, shareReplay } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { clean } from '@dereekb/dbx-core';

/**
 * Coordinates popup display by registering with {@link DbxPopupCoordinatorService} and only rendering content when this popup is the active one for its key.
 *
 * @example
 * ```html
 * <dbx-popup-coordinator>
 *   <div>Popup content rendered only when active.</div>
 * </dbx-popup-coordinator>
 * ```
 */
@Component({
  selector: 'dbx-popup-coordinator',
  template: `
    @if (showSignal()) {
      <ng-content></ng-content>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPopupCoordinatorComponent {
  private readonly _service = inject(DbxPopupCoordinatorService);
  private readonly _popup = inject(DbxPopupController);

  readonly isPopupForKey$ = this._service.popups$.pipe(
    map((x) => x.get(this._popup.key) === this._popup),
    shareReplay(1)
  );

  readonly show$ = this.isPopupForKey$.pipe(delay(0));
  readonly showSignal = toSignal(this.show$);

  constructor() {
    this._service.addPopup(this._popup);
    clean(() => this._service.removePopup(this._popup.key, this._popup));
  }
}
