import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DbxDetachController, DbxDetachWindowState } from './detach';

/**
 * Wraps detach body content, hiding the body when the panel is minimized while keeping the controls visible.
 *
 * @example
 * ```html
 * <dbx-detach-content>
 *   <dbx-detach-controls controls [header]="'My Panel'"></dbx-detach-controls>
 *   <p>Body content here.</p>
 * </dbx-detach-content>
 * ```
 */
@Component({
  selector: 'dbx-detach-content',
  template: `
    <ng-content select="[controls]"></ng-content>
    @if (showContentSignal()) {
      <div class="dbx-detach-content-container">
        <ng-content></ng-content>
      </div>
    }
  `,
  host: {
    class: 'dbx-detach-content'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxDetachContentComponent {
  private readonly _detachController = inject(DbxDetachController);

  readonly showContent$ = this._detachController.windowState$.pipe(map((x) => x !== DbxDetachWindowState.MINIMIZED));
  readonly showContentSignal = toSignal(this.showContent$, { initialValue: true });
}
