import { Directive, type EmbeddedViewRef, Injector, TemplateRef, ViewContainerRef, type OnDestroy, type OnInit, inject, effect, input } from '@angular/core';
import { type DbxInjectionContext, type DbxInjectionContextConfig, provideDbxInjectionContext } from './injection.context';
import { DbxInjectionInstance } from './injection.instance';
import { type DbxInjectionComponentConfig } from './injection';
import { type PromiseOrValue, type PromiseReference, promiseReference, type Maybe } from '@dereekb/util';

/**
 * Structural directive that implements {@link DbxInjectionContext}, allowing its host content
 * to be temporarily replaced with a dynamically injected component and then restored.
 *
 * Unlike `*ngIf` or `*ngSwitch`, the original child content is **detached** (hidden) rather than
 * destroyed, so component state is preserved while the injected context is active. When the
 * context's promise resolves or {@link resetContext} is called, the original view is re-attached.
 *
 * The directive also accepts an optional `[dbxInjectionContext]` input to set a static component
 * config directly, which replaces the default content until cleared.
 *
 * @typeParam O - The output type produced by {@link showContext}.
 *
 * @example
 * ```html
 * <!-- Wrap content that should be temporarily replaceable -->
 * <div *dbxInjectionContext>
 *   <p>Original content preserved while context is active</p>
 * </div>
 * ```
 *
 * @example
 * ```typescript
 * // Programmatically show a temporary editor overlay:
 * const result = await injectionContext.showContext({
 *   config: { componentClass: InlineEditorComponent },
 *   use: (editor) => editor.waitForSave()
 * });
 * ```
 *
 * @see {@link DbxInjectionContext}
 * @see {@link DbxInjectionContextConfig}
 */
@Directive({
  selector: '[dbxInjectionContext]',
  providers: provideDbxInjectionContext(DbxInjectionContextDirective),
  standalone: true
})
export class DbxInjectionContextDirective<O = unknown> implements DbxInjectionContext, OnInit, OnDestroy {
  private readonly _injector = inject(Injector);
  private readonly _templateRef = inject(TemplateRef<O>);
  private readonly _viewContainer = inject(ViewContainerRef);

  private readonly _instance = new DbxInjectionInstance(this._injector);

  private _currentPromise: Maybe<PromiseReference<unknown>>;
  private _embeddedView!: EmbeddedViewRef<O>;
  private _isDetached = false;

  /**
   * Optional static component config input. When set, the directive replaces its content
   * with the specified component. When cleared (`undefined`), the original content is restored.
   */
  readonly config = input<Maybe<DbxInjectionComponentConfig<unknown>>>();

  protected readonly _configEffect = effect(() => {
    this.setConfig(this.config());

    // NOTE: we have/call setConfig() because the effect() may not respond to all value changes,
    // especially when setConfig() ends up being called twice quickly in quick succession.
  });

  ngOnInit() {
    this._instance.content = this._viewContainer;
    this._instance.init();
    this._embeddedView = this._viewContainer.createEmbeddedView(this._templateRef);

    // detach the embedded view
    this._viewContainer.detach();

    // reattach it through the template configuration.
    // the template configuration acts as the default.
    this._instance.template = {
      viewRef: this._embeddedView
    };
  }

  ngOnDestroy(): void {
    this._instance.destroy();
    this._embeddedView?.destroy(); // destroy our embedded view too if it is set.
  }

  /**
   * {@inheritDoc DbxInjectionContext.showContext}
   */
  async showContext<T, O>(config: DbxInjectionContextConfig<T>): Promise<O> {
    // clear the current context before showing something new.
    this.resetContext();

    let promiseRef: Maybe<PromiseReference<O>>;

    let result: Maybe<O>;
    let error: unknown;

    // wait for the promise to resolve and use to finish using that instance.
    try {
      promiseRef = promiseReference(async (resolve, reject) => {
        const injectionConfig: DbxInjectionComponentConfig<T> = {
          ...config.config,
          init: async (instance: T) => {
            // init if available in the base config.
            if (config.config.init) {
              config.config.init(instance);
            }

            try {
              const result = (await config.use(instance)) as PromiseOrValue<O>;
              resolve(result);
            } catch (e) {
              reject(e);
            }
          }
        };

        this.setConfig(injectionConfig as DbxInjectionComponentConfig<unknown>);
      });

      this._currentPromise = promiseRef as PromiseReference<unknown>;

      // await the promise
      await promiseRef.promise;
    } catch (e) {
      error = e;
    }

    // if we're still using the same promiseRef
    if (promiseRef && promiseRef === this._currentPromise) {
      // clear the config to reshow the view
      this.setConfig(undefined);

      // clear the current promise
      this._currentPromise = undefined;
    }

    if (error != null) {
      return Promise.reject(error);
    } else {
      return result as O;
    }
  }

  /**
   * {@inheritDoc DbxInjectionContext.resetContext}
   */
  resetContext(): boolean {
    let clearedValue = false;

    if (this._currentPromise) {
      const promise = this._currentPromise;

      // clear the current promise too
      this._currentPromise = undefined;

      // clear the config.
      this.setConfig(undefined);

      // send a rejection signal to bail out.
      promise.reject(new Error('dbxInjectionContext bailout'));

      clearedValue = true;
    }

    return clearedValue;
  }

  /**
   * Sets or clears the active component configuration.
   *
   * When a config is provided, the original embedded view is detached and the component is injected.
   * When `undefined` is provided, the injected component is removed and the original view is re-attached.
   *
   * @param config - The component config to display, or `undefined` to restore the original content.
   */
  setConfig(config: Maybe<DbxInjectionComponentConfig<unknown>>) {
    let reattach = false;

    if (config) {
      if (!this._isDetached) {
        // detach the original view before setting config.
        this._viewContainer.detach();
        this._isDetached = true;
      }
    } else if (this._isDetached) {
      reattach = true;
    }

    this._instance.config = config;

    if (reattach) {
      this._viewContainer.insert(this._embeddedView);
      this._isDetached = false;
    }
  }
}
