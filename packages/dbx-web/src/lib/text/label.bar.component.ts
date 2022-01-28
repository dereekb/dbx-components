import { Component, Input } from '@angular/core';

/**
 * Acts as a divider between content and centers a label within a background.
 */
@Component({
  selector: 'dbx-label-bar',
  template: `
  <div class="dbx-label-bar dbx-hint mat-small dbx-text-center">
    <mat-icon class="button-spacer" *ngIf="icon">{{ icon }}</mat-icon>
    <span *ngIf="text">{{ text }}</span>
  </div>`,
  // TODO: styleUrls: ['./text.scss']
})
export class DbNgxLabelBarComponent {

  @Input()
  text?: string;

  @Input()
  icon?: string;

}
