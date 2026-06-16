import { type EnvironmentProviders, InjectionToken, type Provider, makeEnvironmentProviders } from '@angular/core';
import { type DbxStyleDemoTemplateToggle } from './template.toggle';

/**
 * Multi-provider injection token collecting every {@link DbxStyleDemoTemplateToggle} contributed by an app's libraries.
 *
 * Injected by the `<dbx-style-demo>` playground (as an array) to populate the template-lever list in the controls UI.
 */
export const DBX_STYLE_DEMO_TEMPLATE_TOGGLE = new InjectionToken<DbxStyleDemoTemplateToggle>('DbxStyleDemoTemplateToggle');

/**
 * Registers one or more {@link DbxStyleDemoTemplateToggle} levers with the style-demo playground.
 *
 * Each toggle is contributed via the {@link DBX_STYLE_DEMO_TEMPLATE_TOGGLE} multi-provider, so several libraries can
 * each add their own levers.
 *
 * @param toggles - The template toggles to register.
 * @returns EnvironmentProviders contributing the toggles.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDbxStyleDemoTemplateToggles(...toggles: DbxStyleDemoTemplateToggle[]): EnvironmentProviders {
  const providers: Provider[] = toggles.map((toggle) => ({
    provide: DBX_STYLE_DEMO_TEMPLATE_TOGGLE,
    useValue: toggle,
    multi: true
  }));

  return makeEnvironmentProviders(providers);
}
