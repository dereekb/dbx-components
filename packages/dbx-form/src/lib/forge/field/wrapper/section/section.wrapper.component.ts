import { ChangeDetectionStrategy, Component, computed, inject, viewChild, ViewContainerRef } from '@angular/core';
import { DbxSectionComponent, DbxSubSectionComponent, type DbxSectionHeaderConfig } from '@dereekb/dbx-web';
import { FieldWrapperContract, WRAPPER_FIELD_CONTEXT, type WrapperFieldContext } from '@ng-forge/dynamic-forms';
import type { DbxForgeSectionWrapper } from './section.wrapper';

/**
 * Forge wrapper component that renders child fields inside a
 * `<dbx-section>` or `<dbx-subsection>`.
 *
 * Implements {@link FieldWrapperContract} and reads configuration from
 * {@link WRAPPER_FIELD_CONTEXT}.
 */
@Component({
  selector: 'dbx-forge-section-wrapper',
  template: `
    @if (subsection()) {
      <dbx-subsection [headerConfig]="headerConfig()">
        <ng-container #fieldComponent></ng-container>
      </dbx-subsection>
    } @else {
      <dbx-section [headerConfig]="headerConfig()" [elevate]="elevate()">
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

  private readonly context = inject<WrapperFieldContext<DbxForgeSectionWrapper>>(WRAPPER_FIELD_CONTEXT);

  readonly headerConfig = computed((): DbxSectionHeaderConfig => {
    return this.context.config.headerConfig ?? {};
  });

  readonly elevate = computed((): boolean => {
    return this.context.config.elevate ?? false;
  });

  readonly subsection = computed((): boolean => {
    return this.context.config.subsection ?? false;
  });
}
