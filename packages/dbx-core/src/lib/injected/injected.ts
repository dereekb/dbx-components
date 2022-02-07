import { Injector, NgModuleRef, StaticProvider, TemplateRef, Type, ViewRef } from "@angular/core";
import { Maybe } from "@dereekb/util";

export interface DbxInjectedComponentConfig<T = any> {
  /**
   * Type of Component to initialize.
   */
  componentClass: Type<T>;
  /**
   * (Optional) providers to provide to the existing injector.
   */
  providers?: StaticProvider[];
  /**
   * (Optional) Custom Injector to use when creating the component. If provided, providers is ignored.
   */
  injector?: Injector;
  /**
   * (Optional) Module ref to use when creating the component.
   */
  ngModuleRef?: NgModuleRef<unknown>;
  /**
   * (Optional) Custom initialization code when an instance is created.
   */
  init?: (instance: T) => void;
}

export interface DbxInjectedTemplateConfig<T = any> {
  /**
   * Template ref to display.
   */
  templateRef?: Maybe<TemplateRef<T>>;
  /**
   * View ref to inject.
   */
  viewRef?: Maybe<ViewRef>;
}
