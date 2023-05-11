import { InjectionToken, Injector, NgModuleRef, StaticProvider, TemplateRef, Type, ViewRef } from '@angular/core';
import { FactoryWithRequiredInput, filterMaybeValues, Maybe, mergeArrays, mergeObjects } from '@dereekb/util';

export const DBX_INJECTION_COMPONENT_DATA = new InjectionToken('DbxInjectionComponentConfigData');

export interface DbxInjectionComponentConfig<T = unknown> {
  /**
   * Type of Component to initialize.
   */
  componentClass: Type<T>;
  /**
   * (Optional) providers to provide to the existing injector.
   */
  providers?: StaticProvider[];
  /**
   * (Optional) Custom parent injector to use when creating the component.
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
  /**
   * unknown optional data to inject into the component.
   */
  data?: unknown;
}

/**
 * The injector may be important to where the dbxInjection is getting injected at. Some types may disallow setting a custom parent injector.
 */
export type DbxInjectionComponentConfigWithoutInjector<T = unknown> = Omit<DbxInjectionComponentConfig<T>, 'injector'>;

export type DbxInjectionComponentConfigFactory<I, T = unknown> = FactoryWithRequiredInput<DbxInjectionComponentConfig<T>, I>;

export interface DbxInjectionTemplateConfig<T = unknown> {
  /**
   * Template ref to display.
   */
  templateRef?: Maybe<TemplateRef<T>>;
  /**
   * View ref to inject.
   */
  viewRef?: Maybe<ViewRef>;
}

/**
 * Merges multiple configurations into a single configuration.
 *
 * @param configs
 * @returns
 */
export function mergeDbxInjectionComponentConfigs<T = unknown>(configs: Maybe<Partial<DbxInjectionComponentConfig<T>>>[]): Partial<DbxInjectionComponentConfig<T>> {
  const providers = mergeArrays(filterMaybeValues(configs).map((x) => x.providers));
  const result = mergeObjects(configs);
  result.providers = providers;
  return result;
}
