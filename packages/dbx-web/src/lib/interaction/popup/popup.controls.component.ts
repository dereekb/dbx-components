import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DbxPopupControlButtonsComponent } from './popup.controls.buttons.component';

/**
 * Popup Controls
 */
@Component({
  selector: 'dbx-popup-controls',
  template: `
    <span class="dbx-popup-controls-header">{{ header() }}</span>
    <div class="spacer"></div>
    <dbx-popup-control-buttons></dbx-popup-control-buttons>
  `,
  host: {
    class: 'dbx-popup-controls'
  },
  imports: [DbxPopupControlButtonsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPopupControlsComponent {
  readonly header = input<string>();
}
