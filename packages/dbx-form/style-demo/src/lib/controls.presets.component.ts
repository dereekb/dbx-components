import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { of } from 'rxjs';
import { DbxFormlyComponent, formlyPickableItemChipField, type PickableValueFieldValue, provideFormlyContext } from '@dereekb/dbx-form';
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
 * Because the chip field is a `dbx-formly` field, the host app must register its formly field declarations (the demo
 * app does so via `provideDbxFormConfiguration()` + `provideDbxFormFormlyFieldDeclarations()`).
 *
 * This component is demo/debug-only and disposable — it is not a dbx-form core runtime primitive.
 */
@Component({
  selector: 'dbx-form-style-demo-presets',
  template: `
    <dbx-formly></dbx-formly>
  `,
  standalone: true,
  imports: [DbxFormlyComponent],
  providers: [provideFormlyContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFormStyleDemoPresetsComponent extends AbstractDbxFormStyleDemoControlsFormDirective<DbxFormStyleDemoPresetsFormValue> {
  readonly fields: FormlyFieldConfig[] = [
    formlyPickableItemChipField<DbxStyleDemoStyleTemplateKey, DbxStyleDemoTemplateToggle>({
      key: 'presets',
      label: 'Presets',
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
    })
  ];

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
