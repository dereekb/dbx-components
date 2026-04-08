import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DbxSectionHeaderComponent, type DbxSectionHeaderConfig } from '@dereekb/dbx-web';
import { type FieldTree } from '@angular/forms/signals';
import type { DynamicText, FieldMeta, ValidationMessages } from '@ng-forge/dynamic-forms';
import type { ForgeSectionHeaderFieldProps } from './section.header.field';

/**
 * Forge ValueFieldComponent that renders a section header.
 *
 * Displays a heading with optional icon and hint text using the
 * {@link DbxSectionHeaderComponent} from `@dereekb/dbx-web`.
 * This field is display-only and contributes no value to the form model.
 */
@Component({
  selector: 'dbx-forge-section-header-field',
  template: `
    <dbx-section-header [headerConfig]="headerConfigSignal()"></dbx-section-header>
  `,
  imports: [DbxSectionHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class ForgeSectionHeaderFieldComponent {
  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<unknown>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgeSectionHeaderFieldProps | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly headerConfigSignal = computed((): DbxSectionHeaderConfig => {
    return this.props()?.headerConfig ?? {};
  });
}
