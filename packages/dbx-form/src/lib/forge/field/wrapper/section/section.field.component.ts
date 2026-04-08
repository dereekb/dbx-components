import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { DbxSectionComponent, DbxSubSectionComponent, type DbxSectionHeaderConfig } from '@dereekb/dbx-web';
import { AbstractForgeWrapperFieldComponent } from '../wrapper.field';
import { ForgeWrapperContentComponent } from '../wrapper.content.component';
import type { ForgeSectionFieldProps } from './section.field';

/**
 * Forge wrapper field component that renders child fields inside a
 * `<dbx-section>` or `<dbx-subsection>`.
 *
 * This is the forge equivalent of formly's `DbxFormSectionWrapperComponent`,
 * providing proper semantic section structure with header and content area.
 */
@Component({
  selector: 'dbx-forge-section-field',
  template: `
    @if (subsectionSignal()) {
      <dbx-subsection [headerConfig]="headerConfigSignal()">
        <dbx-forge-wrapper-content [config]="childConfigSignal()" [(value)]="childValueSignal" />
      </dbx-subsection>
    } @else {
      <dbx-section [headerConfig]="headerConfigSignal()" [elevate]="elevateSignal()">
        <dbx-forge-wrapper-content [config]="childConfigSignal()" [(value)]="childValueSignal" />
      </dbx-section>
    }
  `,
  imports: [DbxSectionComponent, DbxSubSectionComponent, ForgeWrapperContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class ForgeSectionFieldComponent extends AbstractForgeWrapperFieldComponent<ForgeSectionFieldProps> {
  readonly headerConfigSignal = computed((): DbxSectionHeaderConfig => {
    return this.props()?.headerConfig ?? {};
  });

  readonly elevateSignal = computed((): boolean => {
    return this.props()?.elevate ?? false;
  });

  readonly subsectionSignal = computed((): boolean => {
    return this.props()?.subsection ?? false;
  });
}
