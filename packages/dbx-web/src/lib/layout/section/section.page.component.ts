import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DbxSectionHeaderComponent } from './section.header.component';

/**
 * Scroll locking modes for a section page.
 *
 * - `'all'` - The entire header and body scroll together.
 * - `'body'` - The header stays fixed while the body scrolls.
 * - `'locked'` - All overflow is hidden and scrolling is disabled.
 */
export type DbxSectionPageScrollLockedMode = 'all' | 'body' | 'locked';

/**
 * Renders a full page section with a header (defaulting to h2) and scrollable body area.
 * Supports nested section pages that retain proper fixed-height layout. Use for top-level
 * page content that needs a prominent heading.
 *
 * @example
 * ```html
 * <dbx-section-page header="Page Title" icon="dashboard">
 *   <p>Page content here.</p>
 * </dbx-section-page>
 *
 * <dbx-section-page header="Scrollable Body" scroll="body" hint="Only the body scrolls">
 *   <div style="height: 2000px">Tall content</div>
 * </dbx-section-page>
 * ```
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
