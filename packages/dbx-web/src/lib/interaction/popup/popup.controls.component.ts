import { Component, Input } from '@angular/core';

/**
 * Popup Controls
 */
@Component({
  selector: 'dbx-popup-controls',
  template: `
    <span class="dbx-popup-controls-header">{{ header }}</span>
    <div class="spacer"></div>
    <dbx-popup-control-buttons></dbx-popup-control-buttons>
  `,
  host: {
    'class': 'dbx-popup-controls'
  }
})
export class DbxPopupControlsComponent {

  @Input()
  header?: string;

}
