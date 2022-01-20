import { Injector, TemplateRef, Type, ViewRef } from "@angular/core";
import { Maybe } from "@dereekb/util";

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

export interface DbNgxInjectedTemplateConfig<T = any> {
  /**
   * Template ref to display.
   */
  templateRef?: Maybe<TemplateRef<T>>;
  /**
   * View ref to inject.
   */
  viewRef?: Maybe<ViewRef>;
}
