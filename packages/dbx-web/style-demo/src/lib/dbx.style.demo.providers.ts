import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxStyleDemoStyleLoaderService, DbxStyleDemoStyleLoaderServiceConfig } from './style-loader/style.loader.service';
import { type DbxStyleDemoStyleTemplate } from './style-loader/style.template';
import { DbxStyleDemoControlsService, DbxStyleDemoControlsServiceConfig } from './controls/controls.service';

/**
 * Configuration for {@link provideDbxStyleDemo}.
 */
export interface ProvideDbxStyleDemoConfig {
  /**
   * Templates to seed the {@link DbxStyleDemoStyleLoaderService} with at construction time.
   *
   * Libraries typically register their own templates via their own provider (e.g. `provideDbxWebStyleDemo()`); this
   * app-level seed is for one-off templates an app defines directly.
   */
  readonly templates?: Maybe<DbxStyleDemoStyleTemplate[]>;
  /**
   * When false, the {@link DbxStyleDemoControlsService} does not forward its active style levers into the
   * `DbxStyleService` as a body supplement, so levers only repaint the playground subtree. Defaults to true.
   */
  readonly applyStylesToApp?: Maybe<boolean>;
}

/**
 * Provides the `<dbx-style-demo>` showcase shell: the {@link DbxStyleDemoStyleLoaderService}, the
 * {@link DbxStyleDemoControlsService}, and an optional seed config.
 *
 * Pair with `provideDbxWebStyleDemo()` (and the per-library plumbing providers) to register the sections and style levers.
 *
 * @param config - Optional configuration seeding the loader service with templates and toggling app-wide style forwarding.
 * @returns EnvironmentProviders for the showcase shell.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDbxStyleDemo(config?: ProvideDbxStyleDemoConfig): EnvironmentProviders {
  const providers: Provider[] = [DbxStyleDemoStyleLoaderService, DbxStyleDemoControlsService];

  if (config?.templates) {
    providers.push({
      provide: DbxStyleDemoStyleLoaderServiceConfig,
      useValue: { templates: config.templates }
    });
  }

  if (config?.applyStylesToApp != null) {
    providers.push({
      provide: DbxStyleDemoControlsServiceConfig,
      useValue: { applyStylesToApp: config.applyStylesToApp }
    });
  }

  return makeEnvironmentProviders(providers);
}
