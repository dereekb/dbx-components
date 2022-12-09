import { Component, Input } from '@angular/core';
import { DbxSectionHeaderComponent } from './section.header.component';

/**
 * Scroll locking modes.
 *
 * Types:
 * - all: The entire header + body is scrollable
 * - body: The header is locked while the body is scrollable
 * - locked: Overflow is locked and hidden
 */
export type DbxSectionPageScrollLockedMode = 'all' | 'body' | 'locked';

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
    <div class="dbx-section-header" [h]="h ?? 2" [header]="header" [onlyHeader]="onlyHeader" [icon]="icon" [hint]="hint" [hintInline]="true">
      <ng-content select="[sectionHeader]"></ng-content>
    </div>
    <div class="dbx-section-page-content">
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'd-block dbx-content-page dbx-section-page',
    '[class]': '"dbx-section-page-scroll-" + scroll'
  }
})
export class DbxSectionPageComponent extends DbxSectionHeaderComponent {
  @Input()
  scroll: DbxSectionPageScrollLockedMode = 'all';

  @Input()
  override hintInline = true;
}
