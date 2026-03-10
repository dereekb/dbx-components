import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DbxPopupController, DbxPopupWindowState } from './popup';

/**
 * Wraps popup body content, hiding the body when the popup is minimized while keeping the controls visible.
 *
 * @example
 * ```html
 * <dbx-popup-content>
 *   <dbx-popup-controls controls [header]="'My Popup'"></dbx-popup-controls>
 *   <p>Body content here.</p>
 * </dbx-popup-content>
 * ```
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
