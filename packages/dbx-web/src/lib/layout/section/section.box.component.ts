import { Component, Input } from '@angular/core';

/**
 * Component used to wrap sectional content on an elevated box.
 */
@Component({
  selector: 'dbx-section-box',
  template: `
  <div class="dbx-section-box" [ngClass]="(elevated) ? 'dbx-section-elevated' : ''">
    <ng-content></ng-content>
  </div>
  `,
  // TODO: styleUrls: ['./container.scss']
})
export class DbNgxSectionBoxComponent {

  @Input()
  elevated = true;

}
