import { type EnvironmentProviders } from '@angular/core';
import { type DbxStyleDemoSectionGroup, provideDbxStyleDemoSections } from '@dereekb/dbx-web/style-demo';
import { DbxFormStyleDemoPlaceholderSectionComponent } from './placeholder.section.component';

/**
 * The `@dereekb/dbx-form/style-demo` section group (Phase 1 placeholder).
 */
export const DBX_FORM_STYLE_DEMO_SECTION_GROUP: DbxStyleDemoSectionGroup = {
  libId: 'dbx-form',
  sections: [{ id: 'dbx-form-placeholder', title: 'Form (coming soon)', group: 'form', tags: ['dbx-form'], component: DbxFormStyleDemoPlaceholderSectionComponent, defaultEnabled: true }]
};

/**
 * Registers the `@dereekb/dbx-form/style-demo` sections with the `<dbx-style-demo>` playground.
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
