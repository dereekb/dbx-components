import { type EnvironmentProviders } from '@angular/core';
import { type DbxStyleDemoSectionGroup, provideDbxStyleDemoSections } from '@dereekb/dbx-web/style-demo';
import { DbxFormStyleDemoFieldsSectionComponent } from './fields.section.component';

/**
 * The `@dereekb/dbx-form/style-demo` section group.
 */
export const DBX_FORM_STYLE_DEMO_SECTION_GROUP: DbxStyleDemoSectionGroup = {
  libId: 'dbx-form',
  sections: [{ id: 'dbx-form-fields', title: 'Form Fields', group: 'form', tags: ['dbx-form', 'form'], component: DbxFormStyleDemoFieldsSectionComponent, defaultEnabled: true }]
};

/**
 * Registers the `@dereekb/dbx-form/style-demo` sections with the `<dbx-style-demo>` playground.
 *
 * The Form Fields section renders a `<dbx-formly>` form, so the host app must register its formly field declarations
 * (e.g. `provideDbxFormConfiguration()` + `provideDbxFormFormlyFieldDeclarations()`) for the fields to render.
 *
 * Pair with `provideDbxStyleDemo()` (the shell from `@dereekb/dbx-web/style-demo`).
 *
 * @returns EnvironmentProviders contributing the form sections.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDbxFormStyleDemo(): EnvironmentProviders {
  return provideDbxStyleDemoSections(DBX_FORM_STYLE_DEMO_SECTION_GROUP);
}
