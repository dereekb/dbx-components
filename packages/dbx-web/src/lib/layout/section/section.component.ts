import { ChangeDetectionStrategy, Component, computed, input, Input } from '@angular/core';
import { DbxSectionHeaderComponent } from './section.header.component';

/**
 * Component used to format content on a page within a section.
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
  standalone: true,
  imports: [DbxSectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxSectionComponent extends DbxSectionHeaderComponent {
  readonly elevate = input<boolean>(false);

  readonly classConfig = computed(() => {
    return this.elevate() ? 'dbx-section-elevate dbx-content-elevate' : '';
  });
}
