import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DbxSectionHeaderComponent } from './section.header.component';

/**
 * Displays a content section with a header and body area. The header defaults to an h3 heading
 * and supports optional elevation styling.
 *
 * @example
 * ```html
 * <dbx-section header="My Section" icon="info" hint="Additional context">
 *   <p>Section body content here.</p>
 * </dbx-section>
 *
 * <dbx-section header="Elevated Section" [elevate]="true">
 *   <button sectionHeader>Custom Header Action</button>
 *   <p>Body content with elevated card styling.</p>
 * </dbx-section>
 * ```
 */
@Component({
  selector: 'dbx-section',
  template: `
    <div class="dbx-section-header" [h]="headerConfigSignal().h ?? 3" [header]="headerConfigSignal().header" [onlyHeader]="headerConfigSignal().onlyHeader" [icon]="headerConfigSignal().icon" [hint]="headerConfigSignal().hint" [hintInline]="headerConfigSignal().hintInline">
      <ng-content select="[sectionHeader]"></ng-content>
    </div>
    <div class="dbx-section-content">
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'd-block dbx-section',
    '[class]': 'classConfig()'
  },
  imports: [DbxSectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxSectionComponent extends DbxSectionHeaderComponent {
  readonly elevate = input<boolean>(false);

  readonly classConfig = computed(() => {
    return this.elevate() ? 'dbx-section-elevate dbx-content-elevate' : '';
  });
}
