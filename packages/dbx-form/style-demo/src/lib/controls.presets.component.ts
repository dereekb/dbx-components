import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { FieldDef, FormConfig } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import { DbxForgeFormComponentImportsModule, dbxForgeFormComponentProviders, dbxForgePickableChipField, type PickableValueFieldValue } from '@dereekb/dbx-form';
import { type DbxStyleDemoControls, type DbxStyleDemoStyleTemplateKey, type DbxStyleDemoTemplateToggle } from '@dereekb/dbx-web/style-demo';
import { AbstractDbxFormStyleDemoControlsFormDirective } from './controls.form.directive';

/**
 * Form value for the {@link DbxFormStyleDemoPresetsComponent}: the keys of the active style-lever presets.
 */
export interface DbxFormStyleDemoPresetsFormValue {
  readonly presets: DbxStyleDemoStyleTemplateKey[];
}

/**
 * Slim chip-field controls UI picking which style-lever presets are active, kept in two-way sync with the playground's
 * {@link DbxStyleDemoControls}. Presets restyle the whole app, so this is what the global "Style Controls" detach panel
 * renders.
 *
 * Because the chip field is a `dbx-forge` field, the host app must register its forge field declarations (the demo
 * app does so via `provideDbxFormConfiguration()` + `provideDbxForgeFormFieldDeclarations()`).
 *
 * This component is demo/debug-only and disposable — it is not a dbx-form core runtime primitive.
 */
@Component({
  selector: 'dbx-form-style-demo-presets',
  template: `
    <dbx-forge></dbx-forge>
  `,
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule],
  providers: dbxForgeFormComponentProviders(),
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFormStyleDemoPresetsComponent extends AbstractDbxFormStyleDemoControlsFormDirective<DbxFormStyleDemoPresetsFormValue> {
  readonly formConfig: FormConfig = {
    fields: [
      dbxForgePickableChipField<DbxStyleDemoStyleTemplateKey, DbxStyleDemoTemplateToggle>({
        key: 'presets',
        label: 'Presets',
        props: {
          loadValues: () => of((this.controls()?.templateTogglesSignal() ?? []).map((toggle) => ({ value: toggle.templateName, meta: toggle }))),
          displayForValue: (values: PickableValueFieldValue<DbxStyleDemoStyleTemplateKey, DbxStyleDemoTemplateToggle>[]) => {
            const toggleMap = new Map((this.controls()?.templateTogglesSignal() ?? []).map((toggle) => [toggle.templateName, toggle]));
            return of(
              values.map((x) => {
                const toggle = x.meta ?? toggleMap.get(x.value);
                return { ...x, meta: toggle, label: toggle?.label ?? x.value, sublabel: toggle?.group ?? undefined };
              })
            );
          },
          filterSelectedValues: (input) => {
            const toggles = this.controls()?.templateTogglesSignal() ?? [];
            const groupForKey = new Map(toggles.map((toggle) => [toggle.templateName, toggle.group]));
            const beforeValuesSet = new Set(input.beforeValues);
            const addedKeys = input.afterValues.filter((key) => !beforeValuesSet.has(key));

            let result = input.afterValues;

            addedKeys.forEach((addedKey) => {
              const group = groupForKey.get(addedKey);

              if (group != null) {
                // Same-group presets are mutually exclusive: keep only the newly added key in its group.
                result = result.filter((key) => key === addedKey || groupForKey.get(key) !== group);
              }
            });

            return result;
          }
        }
      })
    ] as FieldDef<unknown>[]
  } as FormConfig;

  protected readControlsValue(controls: DbxStyleDemoControls): DbxFormStyleDemoPresetsFormValue {
    return { presets: [...controls.activeTemplateKeysSignal()] };
  }

  protected applyValueToControls(controls: DbxStyleDemoControls, value: DbxFormStyleDemoPresetsFormValue): void {
    const formPresets = new Set(value.presets ?? []);
    const activeKeys = controls.activeTemplateKeysSignal();

    controls.templateTogglesSignal().forEach((toggle) => {
      const shouldActivate = formPresets.has(toggle.templateName);

      if (shouldActivate !== activeKeys.has(toggle.templateName)) {
        controls.setTemplateActive(toggle.templateName, shouldActivate);
      }
    });
  }
}
