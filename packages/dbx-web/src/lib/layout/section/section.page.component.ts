import { DbxSectionComponent } from './section.component';
import { Component, Input } from '@angular/core';

/**
 * Component used to style a page that is made up of app sections.
 */
@Component({
  selector: 'dbx-section-page',
  template: `
  <div class="dbx-section-page">
    <div class="dbx-section-header" [h]="h ?? 2" [header]="header" [icon]="icon" [hint]="hint">
      <ng-content select="[sectionHeader]"></ng-content>
    </div>
    <ng-content></ng-content>
  </div>
  `,
  styleUrls: ['./section.page.component.scss']
})
export class DbxSectionPageComponent extends DbxSectionComponent { }