import { type Provider, type Type } from '@angular/core';
import { type DbxInjectionComponentConfig } from './injection';

/**
 * Configuration for temporarily showing a dynamically injected component via {@link DbxInjectionContext.showContext}.
 *
 * Defines both the component to inject and a `use` callback that interacts with the created instance.
 * The injected view is displayed until the promise returned by `use` resolves, at which point
 * the original content is restored.
 *
 * @typeParam T - The type of the component being injected.
 * @typeParam O - The type of the value resolved by the `use` promise.
 *
 * @example
 * ```typescript
 * const contextConfig: DbxInjectionContextConfig<MyEditorComponent, string> = {
 *   config: { componentClass: MyEditorComponent },
 *   use: async (editor) => {
 *     return await editor.waitForUserInput();
 *   }
 * };
 *
 * const result = await injectionContext.showContext(contextConfig);
 * ```
 */
export interface DbxInjectionContextConfig<T = unknown, O = unknown> {
  /**
   * The {@link DbxInjectionComponentConfig} describing which component to create and how to configure it.
   */
  config: DbxInjectionComponentConfig<T>;
  /**
   * Callback invoked with the created component instance. The returned promise controls how long
   * the injected view remains visible; the original content is restored once it resolves.
   */
  use: (instance: T) => Promise<O>;
}

/**
 * Abstract service for temporarily replacing a view's content with a dynamically injected component,
 * then restoring the original content when done.
 *
 * Unlike `*ngIf` or `*ngSwitch`, the original child content is **hidden** rather than destroyed,
 * preserving component state. Once the injected context's promise resolves (or is reset), the
 * original content is re-displayed.
 *
 * This is useful for overlay-like workflows such as inline editors, confirmation dialogs,
 * or multi-step flows where destroying and recreating the underlying view would lose state.
 *
 * @see {@link DbxInjectionContextConfig}
 * @see {@link DbxInjectionContextDirective} - The concrete structural directive implementation.
 */
export abstract class DbxInjectionContext {
  /**
   * Temporarily replaces the current view content with the component described by `config`.
   *
   * The original content is hidden (not destroyed) and is restored once the `use` promise
   * in the config resolves or rejects.
   *
   * @typeParam T - The type of the injected component.
   * @typeParam O - The return type of the `use` promise.
   * @param config - The context configuration describing the component and usage callback.
   * @returns A promise that resolves with the value from `config.use`.
   */
  abstract showContext<T = unknown, O = unknown>(config: DbxInjectionContextConfig<T>): Promise<O>;

  /**
   * Cancels any active context, rejecting its promise and restoring the original content.
   *
   * @returns `true` if there was an active context that was reset, `false` otherwise.
   */
  abstract resetContext(): boolean;
}

/**
 * Creates Angular providers that register a concrete {@link DbxInjectionContext} implementation
 * under the abstract `DbxInjectionContext` token via `useExisting`.
 *
 * This enables dependency injection consumers to request `DbxInjectionContext` and receive
 * the specific directive or service implementation.
 *
 * @typeParam T - The concrete type that extends {@link DbxInjectionContext}.
 * @param type - The concrete class to register as the existing provider.
 * @returns An array of Angular providers.
 */
export function provideDbxInjectionContext<T extends DbxInjectionContext>(type: Type<T>): Provider[] {
  return [
    {
      provide: DbxInjectionContext,
      useExisting: type
    }
  ];
}
