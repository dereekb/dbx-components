import { DbNgxInjectedComponentConfig } from "@dereekb/ngx-core";

export abstract class DbNgxRouterWebProviderConfig {

  /**
   * Component used by the Anchor component to render a SegueRef link.
   */
  abstract anchorSegueRefComponent: DbNgxInjectedComponentConfig;

}
