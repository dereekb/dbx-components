import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { DBX_STYLE_DEMO_CONTROLS_COMPONENT, DBX_STYLE_DEMO_SECTIONS_COMPONENT, type DbxStyleDemoSectionGroup, provideDbxStyleDemoSections } from '@dereekb/dbx-web/style-demo';
import { DbxFormStyleDemoControlsDetachComponent } from './controls.detach.component';
import { DbxFormStyleDemoSectionsPopoverComponent } from './controls.sections.popover.component';
import { DbxFormStyleDemoFieldsSectionComponent } from './fields.section.component';

/**
 * The `@dereekb/dbx-form/style-demo` section group.
 */
export const DBX_FORM_STYLE_DEMO_SECTION_GROUP: DbxStyleDemoSectionGroup = {
  libId: 'dbx-form',
  sections: [{ id: 'dbx-form-fields', title: 'Form Fields', group: 'form', tags: ['dbx-form', 'form'], component: DbxFormStyleDemoFieldsSectionComponent, defaultEnabled: true }]
};

/**
 * Registers the `@dereekb/dbx-form/style-demo` sections with the `<dbx-style-demo>` playground, registers
 * {@link DbxFormStyleDemoControlsDetachComponent} as the global style-demo controls (presets) detach panel, and registers
 * {@link DbxFormStyleDemoSectionsPopoverComponent} as the style-demo sections popover opened from the playground header.
 *
 * The Form Fields section, the controls panel, and the sections popover all render `<dbx-formly>` forms, so the host app
 * must register its formly field declarations (e.g. `provideDbxFormConfiguration()` + `provideDbxFormFormlyFieldDeclarations()`) for them to render.
 *
 * Pair with `provideDbxStyleDemo()` (the shell from `@dereekb/dbx-web/style-demo`).
 *
 * @returns EnvironmentProviders contributing the form sections, the controls detach component, and the sections popover component.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDbxFormStyleDemo(): EnvironmentProviders {
  return makeEnvironmentProviders([provideDbxStyleDemoSections(DBX_FORM_STYLE_DEMO_SECTION_GROUP), { provide: DBX_STYLE_DEMO_CONTROLS_COMPONENT, useValue: DbxFormStyleDemoControlsDetachComponent }, { provide: DBX_STYLE_DEMO_SECTIONS_COMPONENT, useValue: DbxFormStyleDemoSectionsPopoverComponent }]);
}
