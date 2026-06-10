import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { of } from 'rxjs';
import { DbxFormlyComponent, formlyPickableItemChipField, type PickableValueFieldValue, provideFormlyContext } from '@dereekb/dbx-form';
import { type DbxStyleDemoControls, type DbxStyleDemoSection, type DbxStyleDemoSectionId } from '@dereekb/dbx-web/style-demo';
import { AbstractDbxFormStyleDemoControlsFormDirective } from './controls.form.directive';

/**
 * Form value for the {@link DbxFormStyleDemoSectionsComponent}: the ids of the enabled (visible) sections.
 */
export interface DbxFormStyleDemoSectionsFormValue {
  readonly sections: DbxStyleDemoSectionId[];
}

/**
 * Slim chip-field controls UI picking which showcase sections are visible, kept in two-way sync with the playground's
 * {@link DbxStyleDemoControls}. Sections only affect the `<dbx-style-demo>` playground page, so this renders inside a
 * popover opened from the playground header rather than the global controls panel.
 *
 * Because the chip field is a `dbx-formly` field, the host app must register its formly field declarations (the demo
 * app does so via `provideDbxFormConfiguration()` + `provideDbxFormFormlyFieldDeclarations()`).
 *
 * This component is demo/debug-only and disposable — it is not a dbx-form core runtime primitive.
 */
@Component({
  selector: 'dbx-form-style-demo-sections',
  template: `
    <dbx-formly></dbx-formly>
  `,
  standalone: true,
  imports: [DbxFormlyComponent],
  providers: [provideFormlyContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFormStyleDemoSectionsComponent extends AbstractDbxFormStyleDemoControlsFormDirective<DbxFormStyleDemoSectionsFormValue> {
  readonly fields: FormlyFieldConfig[] = [
    formlyPickableItemChipField<DbxStyleDemoSectionId, DbxStyleDemoSection>({
      key: 'sections',
      label: 'Sections',
      showSelectAllButton: true,
      loadValues: () => of((this.controls()?.sectionsSignal() ?? []).map((section) => ({ value: section.id, meta: section }))),
      displayForValue: (values: PickableValueFieldValue<DbxStyleDemoSectionId, DbxStyleDemoSection>[]) => {
        const sectionMap = new Map((this.controls()?.sectionsSignal() ?? []).map((section) => [section.id, section]));
        return of(
          values.map((x) => {
            const section = x.meta ?? sectionMap.get(x.value);
            return { ...x, meta: section, label: section?.title ?? x.value, sublabel: section?.group ?? undefined };
          })
        );
      }
    })
  ];

  protected readControlsValue(controls: DbxStyleDemoControls): DbxFormStyleDemoSectionsFormValue {
    return { sections: [...controls.enabledIdsSignal()] };
  }

  protected applyValueToControls(controls: DbxStyleDemoControls, value: DbxFormStyleDemoSectionsFormValue): void {
    const formSections = new Set(value.sections ?? []);
    const enabledIds = controls.enabledIdsSignal();

    controls.sectionsSignal().forEach((section) => {
      const shouldEnable = formSections.has(section.id);

      if (shouldEnable !== enabledIds.has(section.id)) {
        controls.setSectionEnabled(section.id, shouldEnable);
      }
    });
  }
}
