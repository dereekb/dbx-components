import { type EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { type DbxStyleDemoSectionGroup } from './section';

/**
 * Multi-provider injection token collecting every {@link DbxStyleDemoSectionGroup} contributed by an app's libraries.
 *
 * Injected by {@link DbxStyleDemoSectionRegistry} (as an array) to assemble the full set of showcase sections.
 */
export const DBX_STYLE_DEMO_SECTION_GROUP = new InjectionToken<DbxStyleDemoSectionGroup>('DbxStyleDemoSectionGroup');

/**
 * Registers a library's {@link DbxStyleDemoSectionGroup} with the style-demo playground.
 *
 * Each call contributes one group via the {@link DBX_STYLE_DEMO_SECTION_GROUP} multi-provider, so several libraries
 * (e.g. `provideDbxWebStyleDemo()`, `provideDbxFormStyleDemo()`) can each add their own sections.
 *
 * @param group - The section group to register.
 * @returns EnvironmentProviders contributing the group.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDbxStyleDemoSections(group: DbxStyleDemoSectionGroup): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: DBX_STYLE_DEMO_SECTION_GROUP,
      useValue: group,
      multi: true
    }
  ]);
}
