import { Component, Input } from '@angular/core';

/**
 * Component used to format content on a page within a section.
 */
@Component({
  selector: 'dbx-section',
  template: `
  <div class="dbx-section">
    <div class="dbx-section-header" [header]="header" [icon]="icon" [hint]="hint">
      <ng-content select="[sectionHeader]"></ng-content>
    </div>
    <div class="dbx-section-content">
      <ng-content></ng-content>
    </div>
  </div>
  `
})
export class DbxSectionComponent {

  @Input()
  header?: string;

  @Input()
  icon?: string;

  @Input()
  hint?: string;

}
