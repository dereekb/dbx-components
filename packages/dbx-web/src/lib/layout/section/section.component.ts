import { Component, Input } from '@angular/core';
import { DbxSectionHeaderComponent } from './section.header.component';

/**
 * Component used to format content on a page within a section.
 */
@Component({
  selector: 'dbx-section',
  template: `
    <div class="dbx-section-header" [h]="3" [header]="header" [icon]="icon" [hint]="hint">
      <ng-content select="[sectionHeader]"></ng-content>
    </div>
    <div class="dbx-section-content">
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'd-block, dbx-section',
    '[class]': `(elevate) ? 'dbx-section-elevate dbx-content-elevate' : ''`
  }
})
export class DbxSectionComponent extends DbxSectionHeaderComponent {
  @Input()
  elevate = false;
}
