import { DbxInjectedComponentConfig } from "@dereekb/dbx-core";

export abstract class DbxRouterWebProviderConfig {

  /**
   * Component used by the Anchor component to render a SegueRef link.
   */
  abstract anchorSegueRefComponent: DbxInjectedComponentConfig;

}
