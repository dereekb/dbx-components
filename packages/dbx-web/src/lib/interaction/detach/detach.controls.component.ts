import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DbxDetachControlButtonsComponent } from './detach.controls.buttons.component';

/**
 * Renders the detach control bar with a header title and window management buttons (attach, detach, minimize, close).
 *
 * @example
 * ```html
 * <dbx-detach-controls [header]="'My Panel'"></dbx-detach-controls>
 * ```
 */
@Component({
  selector: 'dbx-detach-controls',
  template: `
    <span class="dbx-detach-controls-header">{{ header() }}</span>
    <div class="spacer"></div>
    <dbx-detach-control-buttons></dbx-detach-control-buttons>
  `,
  host: {
    class: 'dbx-detach-controls'
  },
  imports: [DbxDetachControlButtonsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxDetachControlsComponent {
  readonly header = input<string>();
}
