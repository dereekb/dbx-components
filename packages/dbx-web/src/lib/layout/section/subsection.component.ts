import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxSectionComponent } from './section.component';
import { DbxSectionHeaderComponent } from './section.header.component';

/**
 * Renders a subsection within a parent section, using a smaller heading (defaults to h4).
 * Useful for grouping related content under a `dbx-section`.
 *
 * @dbxWebComponent
 * @dbxWebSlug subsection
 * @dbxWebCategory layout
 * @dbxWebRelated section, section-header
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-subsection header="Details"><p>Body</p></dbx-subsection>
 * ```
 *
 * @example
 * ```html
 * <dbx-section header="Settings">
 *   <dbx-subsection header="Notifications" icon="notifications">
 *     <p>Subsection body.</p>
 *   </dbx-subsection>
 * </dbx-section>
 * ```
 */
@Component({
  selector: 'dbx-subsection',
  template: `
    <div class="dbx-subsection">
      <div class="dbx-section-header" [h]="headerConfigSignal().h ?? 4" [header]="headerConfigSignal().header" [onlyHeader]="headerConfigSignal().onlyHeader" [icon]="headerConfigSignal().icon" [hint]="headerConfigSignal().hint" [hintInline]="headerConfigSignal().hintInline">
        <ng-content select="[sectionHeader]"></ng-content>
      </div>
      <div class="dbx-section-content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  standalone: true,
  imports: [DbxSectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxSubSectionComponent extends DbxSectionComponent {}
