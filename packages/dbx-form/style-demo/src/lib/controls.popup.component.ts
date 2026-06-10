import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type Maybe, iterablesAreSetEquivalent } from '@dereekb/util';
import { cleanSubscription } from '@dereekb/dbx-core';
import { of, switchMap } from 'rxjs';
import { AbstractSyncFormlyFormDirective, DbxFormlyComponent, formlyPickableItemChipField, type PickableValueFieldValue, provideFormlyContext } from '@dereekb/dbx-form';
import { DbxPopupComponent, DbxPopupContentComponent, DbxPopupControlsComponent } from '@dereekb/dbx-web';
import { type DbxStyleDemoControls, type DbxStyleDemoSection, type DbxStyleDemoSectionId, type DbxStyleDemoStyleTemplateKey, type DbxStyleDemoTemplateToggle } from '@dereekb/dbx-web/style-demo';

/**
 * Form value for the {@link DbxFormStyleDemoControlsPopupComponent}: the ids of the enabled sections and the keys of the active presets.
 */
export interface DbxFormStyleDemoControlsFormValue {
  readonly sections: DbxStyleDemoSectionId[];
  readonly presets: DbxStyleDemoStyleTemplateKey[];
}

/**
 * Chip-field controls popup for the `<dbx-style-demo>` playground, registered as the playground's controls component
 * via `DBX_STYLE_DEMO_CONTROLS_COMPONENT` (see `provideDbxFormStyleDemo()`).
 *
 * Renders two `pickablechipfield`s inside the draggable popup chrome — one picking which showcase sections are visible,
 * one picking which style-lever presets are active — and keeps them in two-way sync with the playground's
 * {@link DbxStyleDemoControls} (read from the popup `data`). The controls UI lives in dbx-form because the pickable chip
 * field is a `@dereekb/dbx-form` field, which `@dereekb/dbx-web` cannot import.
 *
 * Because the chip fields are `dbx-formly` fields, the host app must register its formly field declarations (the demo
 * app does so via `provideDbxFormConfiguration()` + `provideDbxFormFormlyFieldDeclarations()`).
 *
 * This component is demo/debug-only and disposable — it is not a dbx-form core runtime primitive.
 */
@Component({
  selector: 'dbx-form-style-demo-controls-popup',
  template: `
    <dbx-popup-content>
      <dbx-popup-controls header="Style Controls" controls></dbx-popup-controls>
      <div class="dbx-p3 dbx-form-style-demo-controls-popup-body">
        <dbx-formly></dbx-formly>
      </div>
    </dbx-popup-content>
  `,
  styles: [
    `
      .dbx-form-style-demo-controls-popup-body {
        max-height: 60vh;
        overflow-y: auto;
      }
    `
  ],
  standalone: true,
  imports: [DbxPopupContentComponent, DbxPopupControlsComponent, DbxFormlyComponent],
  providers: [provideFormlyContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFormStyleDemoControlsPopupComponent extends AbstractSyncFormlyFormDirective<DbxFormStyleDemoControlsFormValue> {
  private readonly _popup = inject(DbxPopupComponent<void, DbxStyleDemoControls>);

  /**
   * The latest form value applied to or read from the form, used to guard against redundant `setValue` resets when the
   * playground signals and the form already agree (so playground↔form round-trips converge to zero changes).
   */
  private _currentFormValue: Maybe<DbxFormStyleDemoControlsFormValue>;

  readonly fields: FormlyFieldConfig[] = [
    formlyPickableItemChipField<DbxStyleDemoSectionId, DbxStyleDemoSection>({
      key: 'sections',
      label: 'Sections',
      showSelectAllButton: true,
      loadValues: () => of((this.controls?.sectionsSignal() ?? []).map((section) => ({ value: section.id, meta: section }))),
      displayForValue: (values: PickableValueFieldValue<DbxStyleDemoSectionId, DbxStyleDemoSection>[]) => {
        const sectionMap = new Map((this.controls?.sectionsSignal() ?? []).map((section) => [section.id, section]));
        return of(
          values.map((x) => {
            const section = x.meta ?? sectionMap.get(x.value);
            return { ...x, meta: section, label: section?.title ?? x.value, sublabel: section?.group ?? undefined };
          })
        );
      }
    }),
    formlyPickableItemChipField<DbxStyleDemoStyleTemplateKey, DbxStyleDemoTemplateToggle>({
      key: 'presets',
      label: 'Presets',
      loadValues: () => of((this.controls?.templateTogglesSignal() ?? []).map((toggle) => ({ value: toggle.templateName, meta: toggle }))),
      displayForValue: (values: PickableValueFieldValue<DbxStyleDemoStyleTemplateKey, DbxStyleDemoTemplateToggle>[]) => {
        const toggleMap = new Map((this.controls?.templateTogglesSignal() ?? []).map((toggle) => [toggle.templateName, toggle]));
        return of(
          values.map((x) => {
            const toggle = x.meta ?? toggleMap.get(x.value);
            return { ...x, meta: toggle, label: toggle?.label ?? x.value, sublabel: toggle?.group ?? undefined };
          })
        );
      }
    })
  ];

  /**
   * Playground → form: push the enabled sections / active presets into the form, but only when the form does not already
   * reflect them (set-equivalent), since `setValue` resets the form.
   */
  protected readonly _syncControlsToFormEffect = effect(() => {
    const controls = this.controls;

    if (controls != null) {
      const sections = [...controls.enabledIdsSignal()];
      const presets = [...controls.activeTemplateKeysSignal()];
      const current = this._currentFormValue;
      const formMatches = current != null && iterablesAreSetEquivalent(current.sections, sections) && iterablesAreSetEquivalent(current.presets, presets);

      if (!formMatches) {
        const value: DbxFormStyleDemoControlsFormValue = { sections, presets };
        this._currentFormValue = value;
        this.context.setValue(value);
      }
    }
  });

  /**
   * Form → playground: on each form change, diff the picked sections / presets against the playground's current signals
   * and apply only the deltas via the existing setters (group-exclusivity in `setTemplateActive` then auto-deselects
   * conflicting Shape presets, which the sync-back effect reflects in the chips).
   */
  protected readonly _syncFormToControlsSub = cleanSubscription(this.context.stream$.pipe(switchMap(() => this.context.getValue())).subscribe((value) => this._applyFormValueToControls(value)));

  get controls(): Maybe<DbxStyleDemoControls> {
    return this._popup.data;
  }

  private _applyFormValueToControls(value: Maybe<DbxFormStyleDemoControlsFormValue>): void {
    const controls = this.controls;

    if (controls != null && value != null) {
      this._currentFormValue = value;

      const formSections = new Set(value.sections ?? []);
      const enabledIds = controls.enabledIdsSignal();

      controls.sectionsSignal().forEach((section) => {
        const shouldEnable = formSections.has(section.id);

        if (shouldEnable !== enabledIds.has(section.id)) {
          controls.setSectionEnabled(section.id, shouldEnable);
        }
      });

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
}
