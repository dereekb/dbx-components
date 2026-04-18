import { ChangeDetectionStrategy, Component, input, viewChild, ViewContainerRef } from '@angular/core';
import { DbxSectionComponent, DbxSubSectionComponent, type DbxSectionHeaderConfig } from '@dereekb/dbx-web';
import { FieldWrapperContract } from '@ng-forge/dynamic-forms';

/**
 * Forge wrapper component that renders child fields inside a
 * `<dbx-section>` or `<dbx-subsection>`.
 *
 * Implements {@link FieldWrapperContract} and receives configuration
 * via component inputs.
 */
@Component({
  selector: 'dbx-forge-section-wrapper',
  template: `
    @if (subsection()) {
      <dbx-subsection [headerConfig]="headerConfig()">
        <ng-container #fieldComponent></ng-container>
      </dbx-subsection>
    } @else {
      <dbx-section [headerConfig]="headerConfig()" [elevate]="elevate() ?? false">
        <ng-container #fieldComponent></ng-container>
      </dbx-section>
    }
  `,
  imports: [DbxSectionComponent, DbxSubSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeSectionWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  readonly headerConfig = input<DbxSectionHeaderConfig>();
  readonly elevate = input<boolean>();
  readonly subsection = input<boolean>();

  constructor() {
    console.log('DbxForgeSectionWrapperComponent constructor');
  }
}
