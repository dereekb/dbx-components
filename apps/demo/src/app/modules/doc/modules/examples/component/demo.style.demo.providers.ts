import { type EnvironmentProviders } from '@angular/core';
import { type DbxStyleDemoSectionGroup, provideDbxStyleDemoSections } from '@dereekb/dbx-web/style-demo';
import { DocStyleDemoNavbarSectionComponent } from './style.demo.navbar.section.component';

/**
 * The demo app's own style-demo section group, contributing sections that require host-app wiring (router state refs).
 */
export const DEMO_STYLE_DEMO_SECTION_GROUP: DbxStyleDemoSectionGroup = {
  libId: 'demo',
  sections: [{ id: 'demo-navbar', title: 'Navbar (demo app)', group: 'demo', tags: ['demo', 'navigation'], component: DocStyleDemoNavbarSectionComponent, defaultEnabled: true }]
};

/**
 * Registers the demo app's own style-demo sections with the `<dbx-style-demo>` playground.
 *
 * Provides the route-bound navbar section, which needs real UIRouter state refs the library packages cannot supply.
 *
 * Pair with `provideDbxStyleDemo()` and the library section groups (`provideDbxWebStyleDemo()`, etc.).
 *
 * @returns EnvironmentProviders contributing the demo app sections.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDemoStyleDemo(): EnvironmentProviders {
  return provideDbxStyleDemoSections(DEMO_STYLE_DEMO_SECTION_GROUP);
}
