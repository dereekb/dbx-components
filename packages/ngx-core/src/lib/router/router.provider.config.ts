import { DbNgxInjectedComponentConfig } from "../injected";

export abstract class DbNgxRouterProviderConfig {

  /**
   * Component used by the Anchor component to render a router.
   */
  abstract anchorComponent: DbNgxInjectedComponentConfig;

}
