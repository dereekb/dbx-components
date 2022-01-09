import { Injector, Type } from "@angular/core";

export interface DbNgxInjectedComponentConfig<T = any> {
  /**
   * Type of Component to initialize.
   */
  componentClass: Type<T>;
  /**
   * Custom Injector to use when creating the component.
   */
  injector?: Injector;
  /**
   * Custom initialization code when an instance is created.
   */
  init?: (instance: T) => void;
}
