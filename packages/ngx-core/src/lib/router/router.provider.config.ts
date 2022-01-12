import { DbNgxInjectedComponentConfig } from "../injected";

export abstract class DbxRouterProviderConfig {

  /**
   * Component used by the Anchor component to render a router.
   */
  abstract anchorComponent: DbNgxInjectedComponentConfig;

}
