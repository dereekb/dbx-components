import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';

/**
 * Abstract configuration that tells the application which component to use for rendering segue-ref anchor links.
 *
 * Use {@link provideDbxRouterWebAngularRouterProviderConfig} for Angular Router or
 * {@link provideDbxRouterWebUiRouterProviderConfig} for UIRouter.
 */
export abstract class DbxRouterWebProviderConfig {
  /**
   * Component used by the Anchor component to render a SegueRef link.
   */
  abstract anchorSegueRefComponent: DbxInjectionComponentConfig;
}
