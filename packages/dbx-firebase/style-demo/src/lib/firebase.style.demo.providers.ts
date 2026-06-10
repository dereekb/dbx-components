import { type EnvironmentProviders } from '@angular/core';
import { type DbxStyleDemoSectionGroup, provideDbxStyleDemoSections } from '@dereekb/dbx-web/style-demo';
import { DbxFirebaseStyleDemoPlaceholderSectionComponent } from './placeholder.section.component';

/**
 * The `@dereekb/dbx-firebase/style-demo` section group (Phase 1 placeholder).
 */
export const DBX_FIREBASE_STYLE_DEMO_SECTION_GROUP: DbxStyleDemoSectionGroup = {
  libId: 'dbx-firebase',
  sections: [{ id: 'dbx-firebase-placeholder', title: 'Firebase (coming soon)', group: 'firebase', tags: ['dbx-firebase'], component: DbxFirebaseStyleDemoPlaceholderSectionComponent, defaultEnabled: true }]
};

/**
 * Registers the `@dereekb/dbx-firebase/style-demo` sections with the `<dbx-style-demo>` playground.
 *
 * Pair with `provideDbxStyleDemo()` (the shell from `@dereekb/dbx-web/style-demo`).
 *
 * @returns EnvironmentProviders contributing the firebase sections.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDbxFirebaseStyleDemo(): EnvironmentProviders {
  return provideDbxStyleDemoSections(DBX_FIREBASE_STYLE_DEMO_SECTION_GROUP);
}
