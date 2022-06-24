import { Component, Input } from '@angular/core';
import { DbxSectionHeaderComponent } from './section.header.component';

/**
 * Component used to style a page that is made up of app sections.
 *
 * Should be used on pages that need a section page heading.
 *
 * Can be nested within eachother, retaining the proper fixed height.
 */
@Component({
  selector: 'dbx-section-page',
  template: `
    <div class="dbx-content-page dbx-section-page">
      <div class="dbx-section-header" [h]="h ?? 2" [header]="header" [onlyHeader]="onlyHeader" [icon]="icon" [hint]="hint" [hintInline]="true">
        <ng-content select="[sectionHeader]"></ng-content>
      </div>
      <ng-content></ng-content>
    </div>
  `
})
export class DbxSectionPageComponent extends DbxSectionHeaderComponent {
  @Input()
  override hintInline = true;
}
