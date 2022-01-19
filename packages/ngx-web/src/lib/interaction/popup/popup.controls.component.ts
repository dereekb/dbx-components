import { Component, Input } from '@angular/core';

/**
 * Popup Controls
 */
@Component({
  selector: 'dbx-popup-controls',
  template: `
  <div class="dbx-popup-controls">
    <span class="dbx-popup-controls-header">{{ header }}</span>
    <div class="spacer"></div>
    <dbx-popup-control-buttons></dbx-popup-control-buttons>
  </div>
  `,
  styleUrls: ['./popup.scss']
})
export class DbNgxPopupControlsComponent {

  @Input()
  header?: string;

}
