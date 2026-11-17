import { Component, input } from '@angular/core';
import { DbxDetachControlButtonsComponent } from './detach.controls.buttons.component';

/**
 * Renders the detach control bar with a header title and window management buttons (attach, detach, minimize, close).
 *
 * Projected content renders before the header title, such as an icon or a badge.
 *
 * @example
 * ```html
 * <dbx-detach-controls [header]="'My Panel'"></dbx-detach-controls>
 *
 * <dbx-detach-controls [header]="'My Panel'">
 *   <mat-icon>edit_note</mat-icon>
 * </dbx-detach-controls>
 * ```
 */
@Component({
  selector: 'dbx-detach-controls',
  template: `
    <ng-content></ng-content>
    <span class="dbx-detach-controls-header">{{ header() }}</span>
    <div class="spacer"></div>
    <dbx-detach-control-buttons></dbx-detach-control-buttons>
  `,
  host: {
    class: 'dbx-detach-controls'
  },
  imports: [DbxDetachControlButtonsComponent]
})
export class DbxDetachControlsComponent {
  readonly header = input<string>();
}
