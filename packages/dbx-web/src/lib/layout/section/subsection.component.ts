import { Component } from '@angular/core';
import { DbxSectionComponent } from './section.component';

/**
 * A subsection.
 */
@Component({
  selector: 'dbx-subsection',
  template: `
  <div class="dbx-subsection">
    <div class="dbx-section-header" [h]="h ?? 4" [header]="header" [icon]="icon" [hint]="hint">
      <ng-content select="[sectionHeader]"></ng-content>
    </div>
    <div class="dbx-section-content">
      <ng-content></ng-content>
    </div>
  </div>
  `
})
export class DbxSubSectionComponent extends DbxSectionComponent { }
