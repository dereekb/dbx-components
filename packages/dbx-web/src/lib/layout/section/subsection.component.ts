import { Component, Input } from '@angular/core';
import { DbxSectionComponent } from './section.component';

/**
 * Component used to format content on a page within a section.
 */
@Component({
  selector: 'dbx-subsection',
  template: `
  <div class="dbx-subsection">
    <h3>{{ header }}</h3>
    <p class="dbx-section-hint">{{ hint }}</p>
    <div class="dbx-section-content">
      <ng-content></ng-content>
    </div>
  </div>
  `,
  // TODO: styleUrls: ['./container.scss']
})
export class DbxSubSectionComponent extends DbxSectionComponent {}