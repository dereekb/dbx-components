import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { FieldDef, FormConfig } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import { DbxForgeFormComponentImportsModule, dbxForgeFormComponentProviders, dbxForgePickableChipField, type PickableValueFieldValue } from '@dereekb/dbx-form';
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
 * Because the chip field is a `dbx-forge` field, the host app must register its forge field declarations (the demo
 * app does so via `provideDbxFormConfiguration()` + `provideDbxForgeFormFieldDeclarations()`).
 *
 * This component is demo/debug-only and disposable — it is not a dbx-form core runtime primitive.
 */
@Component({
  selector: 'dbx-form-style-demo-sections',
  template: `
    <dbx-forge></dbx-forge>
  `,
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule],
  providers: dbxForgeFormComponentProviders(),
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFormStyleDemoSectionsComponent extends AbstractDbxFormStyleDemoControlsFormDirective<DbxFormStyleDemoSectionsFormValue> {
  readonly formConfig: FormConfig = {
    fields: [
      dbxForgePickableChipField<DbxStyleDemoSectionId, DbxStyleDemoSection>({
        key: 'sections',
        label: 'Sections',
        props: {
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
        }
      })
    ] as FieldDef<unknown>[]
  } as FormConfig;

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
