import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DbxPopupController, DbxPopupWindowState } from './popup';

/**
 * Popup content wrapper component.
 */
@Component({
  selector: 'dbx-popup-content',
  template: `
    <ng-content select="[controls]"></ng-content>
    @if (showContentSignal()) {
      <div class="dbx-popup-content-container">
        <ng-content></ng-content>
      </div>
    }
  `,
  host: {
    class: 'dbx-popup-content'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPopupContentComponent {
  private readonly appPopupController = inject(DbxPopupController);

  readonly showContent$ = this.appPopupController.windowState$.pipe(map((x) => x !== DbxPopupWindowState.MINIMIZED));
  readonly showContentSignal = toSignal(this.showContent$, { initialValue: true });
}
