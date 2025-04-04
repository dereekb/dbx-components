import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
    <div class="dbx-section-header" [h]="headerConfigSignal().h ?? 2" [header]="headerConfigSignal().header" [onlyHeader]="headerConfigSignal().onlyHeader" [icon]="headerConfigSignal().icon" [hint]="headerConfigSignal().hint" [hintInline]="headerConfigSignal().hintInline">
      <ng-content select="[sectionHeader]"></ng-content>
    </div>
    <div class="dbx-section-page-content">
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'd-block dbx-content-page dbx-section-page',
    '[class]': 'classConfig()'
  },
  standalone: true,
  imports: [DbxSectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxSectionPageComponent extends DbxSectionHeaderComponent {
  readonly scroll = input<DbxSectionPageScrollLockedMode>('all');

  readonly classConfig = computed(() => {
    return `dbx-section-page-scroll-${this.scroll()}`;
  });

  constructor() {
    super();
    this.hintInlineDefault.set(true);
  }
}
