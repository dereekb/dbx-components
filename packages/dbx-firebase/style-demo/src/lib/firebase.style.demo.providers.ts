import { type EnvironmentProviders } from '@angular/core';
import { type DbxStyleDemoSectionGroup, provideDbxStyleDemoSections } from '@dereekb/dbx-web/style-demo';
import { DbxFirebaseStyleDemoLoginSectionComponent } from './login.section.component';

/**
 * The `@dereekb/dbx-firebase/style-demo` section group.
 */
export const DBX_FIREBASE_STYLE_DEMO_SECTION_GROUP: DbxStyleDemoSectionGroup = {
  libId: 'dbx-firebase',
  sections: [{ id: 'dbx-firebase-login', title: 'Firebase Login', group: 'firebase', tags: ['dbx-firebase', 'login'], component: DbxFirebaseStyleDemoLoginSectionComponent, defaultEnabled: true }]
};

/**
 * Registers the `@dereekb/dbx-firebase/style-demo` sections with the `<dbx-style-demo>` playground.
 *
 * The Firebase Login section renders `dbx-firebase-oauth-login-view` (with `dbx-firebase-login` projected for the
 * `no_user` state), so the host app must provide Firebase auth (`provideDbxFirebase`) and login configuration
 * (`provideDbxFirebaseLogin({ enabledLoginMethods, ... })`). Rendering makes no network calls until a button is clicked.
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
