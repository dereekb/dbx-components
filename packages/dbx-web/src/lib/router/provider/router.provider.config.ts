import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';

/**
 * Provider that describes to the app how to handle anchors.
 *
 * Use provideDbxRouterWebUiRouterProviderConfig() if using UIRouter in your application.
 *  or
 * Use provideDbxRouterWebAngularRouterProviderConfig() if using Angular Router in your application.
 */
export abstract class DbxRouterWebProviderConfig {
  /**
   * Component used by the Anchor component to render a SegueRef link.
   */
  abstract anchorSegueRefComponent: DbxInjectionComponentConfig;
}
