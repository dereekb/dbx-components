import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxSectionComponent } from './section.component';
import { DbxSectionHeaderComponent } from './section.header.component';

/**
 * A subsection.
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
